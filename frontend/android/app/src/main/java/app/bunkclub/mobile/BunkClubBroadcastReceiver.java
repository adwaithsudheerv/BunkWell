package app.bunkclub.mobile;

import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioManager;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class BunkClubBroadcastReceiver extends BroadcastReceiver {

    public static final String ACTION_CLASS_START = "app.bunkclub.action.CLASS_START";
    public static final String ACTION_CLASS_END = "app.bunkclub.action.CLASS_END";
    public static final String ACTION_BUNK_CLICKED = "app.bunkclub.action.BUNK_CLICKED";
    public static final String ACTION_ATTEND_CLICKED = "app.bunkclub.action.ATTEND_CLICKED";
    public static final String CHANNEL_ID = "bunkclub_alerts";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (action == null) return;

        AudioManager audioManager = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
        NotificationManager notifManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        SharedPreferences prefs = context.getSharedPreferences("BunkClubPrefs", Context.MODE_PRIVATE);

        String today = new SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(new Date());
        int periodNumber = intent.getIntExtra("periodNumber", 1);
        String subjectName = intent.getStringExtra("subjectName");
        if (subjectName == null) subjectName = "Lecture";

        String bunkKey = "bunked_" + today + "_P" + periodNumber;
        boolean isBunked = prefs.getBoolean(bunkKey, false);

        if (Intent.ACTION_BOOT_COMPLETED.equals(action)) {
            // Restart background service on device reboot
            Intent serviceIntent = new Intent(context, BunkClubBackgroundService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent);
            } else {
                context.startService(serviceIntent);
            }
            return;
        }

        if (ACTION_CLASS_START.equals(action)) {
            if (isBunked) {
                // User already marked this class as bunked: keep phone unmuted!
                if (audioManager != null) {
                    audioManager.setRingerMode(AudioManager.RINGER_MODE_NORMAL);
                }
                return;
            }

            // AUTO-MUTE PHONE FOR CLASS
            if (audioManager != null) {
                audioManager.setRingerMode(AudioManager.RINGER_MODE_VIBRATE);
            }

            // Notification with direct "Bunk Class" action button
            Intent bunkIntent = new Intent(context, BunkClubBroadcastReceiver.class);
            bunkIntent.setAction(ACTION_BUNK_CLICKED);
            bunkIntent.putExtra("periodNumber", periodNumber);
            bunkIntent.putExtra("subjectName", subjectName);
            PendingIntent bunkPending = PendingIntent.getBroadcast(
                context,
                periodNumber * 200 + 1,
                bunkIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
            );

            Intent attendIntent = new Intent(context, BunkClubBroadcastReceiver.class);
            attendIntent.setAction(ACTION_ATTEND_CLICKED);
            attendIntent.putExtra("periodNumber", periodNumber);
            attendIntent.putExtra("subjectName", subjectName);
            PendingIntent attendPending = PendingIntent.getBroadcast(
                context,
                periodNumber * 200 + 2,
                attendIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
            );

            Intent openAppIntent = new Intent(context, MainActivity.class);
            openAppIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent openPending = PendingIntent.getActivity(
                context,
                periodNumber * 200 + 3,
                openAppIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
            );

            NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle("🔕 Period " + periodNumber + ": " + subjectName + " Started")
                .setContentText("Phone is auto-muted. Bunking this class? Tap to unmute.")
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setContentIntent(openPending)
                .setAutoCancel(true)
                .addAction(android.R.drawable.ic_delete, "❌ Bunk (Unmute)", bunkPending)
                .addAction(android.R.drawable.ic_menu_agenda, "✅ Attending (Muted)", attendPending);

            if (notifManager != null) {
                notifManager.notify(3000 + periodNumber, builder.build());
            }

        } else if (ACTION_ATTEND_CLICKED.equals(action)) {
            // USER ATTENDING: ENSURE MUTED & CLEAR BUNKED FLAG
            prefs.edit().remove(bunkKey).putBoolean("present_" + today + "_P" + periodNumber, true).apply();

            if (audioManager != null) {
                audioManager.setRingerMode(AudioManager.RINGER_MODE_VIBRATE);
            }

            NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle("🔕 Class Attending • Phone Muted")
                .setContentText("Attending Period " + periodNumber + " (" + subjectName + "). Ringer muted for session.")
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setAutoCancel(true);

            if (notifManager != null) {
                notifManager.notify(3000 + periodNumber, builder.build());
            }

        } else if (ACTION_BUNK_CLICKED.equals(action)) {
            // USER BUNKED: IMMEDIATELY UNMUTE PHONE!
            prefs.edit().putBoolean(bunkKey, true).apply();

            if (audioManager != null) {
                audioManager.setRingerMode(AudioManager.RINGER_MODE_NORMAL);
            }

            NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle("🔔 Class Bunked • Phone Unmuted")
                .setContentText("You are outside Period " + periodNumber + " (" + subjectName + "). Ringer is active.")
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setAutoCancel(true);

            if (notifManager != null) {
                notifManager.notify(3000 + periodNumber, builder.build());
            }

        } else if (ACTION_CLASS_END.equals(action)) {
            // CLASS ENDED: RESTORE NORMAL RINGER
            if (audioManager != null) {
                audioManager.setRingerMode(AudioManager.RINGER_MODE_NORMAL);
            }

            NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle("🔔 Period " + periodNumber + " Ended • Ringer Restored")
                .setContentText("Lecture over. Normal ringer mode active.")
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setAutoCancel(true);

            if (notifManager != null) {
                notifManager.cancel(3000 + periodNumber);
                notifManager.notify(4000 + periodNumber, builder.build());
            }
        }
    }
}

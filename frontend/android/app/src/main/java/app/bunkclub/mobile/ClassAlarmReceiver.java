package app.bunkclub.mobile;

import android.app.NotificationChannel;
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

public class ClassAlarmReceiver extends BroadcastReceiver {

    public static final String ACTION_CLASS_START = "app.bunkclub.action.CLASS_START";
    public static final String ACTION_CLASS_END = "app.bunkclub.action.CLASS_END";
    public static final String ACTION_BUNK_DIRECT = "app.bunkclub.action.BUNK_DIRECT";
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
        boolean isHoliday = prefs.getBoolean("holiday_" + today, false);

        if (Intent.ACTION_BOOT_COMPLETED.equals(action)) {
            // Device rebooted - resynchronize alarms if stored
            return;
        }

        if (ACTION_CLASS_START.equals(action)) {
            if (isHoliday || isBunked) {
                // If student marked as bunked or today is a holiday, maintain active audible ringer!
                if (audioManager != null) {
                    audioManager.setRingerMode(AudioManager.RINGER_MODE_NORMAL);
                }
                return;
            }

            // Class starting: Put phone in silent/vibrate mode
            if (audioManager != null) {
                audioManager.setRingerMode(AudioManager.RINGER_MODE_VIBRATE);
            }

            // Build notification with direct "Bunk Class" action button
            Intent bunkIntent = new Intent(context, ClassAlarmReceiver.class);
            bunkIntent.setAction(ACTION_BUNK_DIRECT);
            bunkIntent.putExtra("periodNumber", periodNumber);
            bunkIntent.putExtra("subjectName", subjectName);
            PendingIntent bunkPending = PendingIntent.getBroadcast(
                context,
                periodNumber * 100 + 1,
                bunkIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
            );

            Intent openAppIntent = new Intent(context, MainActivity.class);
            openAppIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent openPending = PendingIntent.getActivity(
                context,
                periodNumber * 100 + 2,
                openAppIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
            );

            NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle("🔕 Period " + periodNumber + ": " + subjectName + " Started")
                .setContentText("Phone is auto-silenced. Bunking this class? Tap to restore active mode.")
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setContentIntent(openPending)
                .setAutoCancel(true)
                .addAction(android.R.drawable.ic_delete, "❌ Bunk (Active Mode)", bunkPending)
                .addAction(android.R.drawable.ic_menu_agenda, "✅ Attending", openPending);

            if (notifManager != null) {
                notifManager.notify(1000 + periodNumber, builder.build());
            }

        } else if (ACTION_BUNK_DIRECT.equals(action)) {
            // Student clicked "Bunk Class" - IMMEDIATELY RESTORE ACTIVE RINGER MODE!
            prefs.edit().putBoolean(bunkKey, true).apply();

            if (audioManager != null) {
                audioManager.setRingerMode(AudioManager.RINGER_MODE_NORMAL);
            }

            // Update notification confirming active mode restored
            NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle("🔔 Class Bunked • Active Mode Restored")
                .setContentText("You are outside Period " + periodNumber + " (" + subjectName + "). Ringer is active.")
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setAutoCancel(true);

            if (notifManager != null) {
                notifManager.notify(1000 + periodNumber, builder.build());
            }

        } else if (ACTION_CLASS_END.equals(action)) {
            // Class period ended: Restore normal active ringer
            if (audioManager != null) {
                audioManager.setRingerMode(AudioManager.RINGER_MODE_NORMAL);
            }

            NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle("🔔 Period " + periodNumber + " Ended • Ringer Restored")
                .setContentText("Did the faculty assign any notes or homework for " + subjectName + "?")
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setAutoCancel(true);

            if (notifManager != null) {
                notifManager.cancel(1000 + periodNumber);
                notifManager.notify(2000 + periodNumber, builder.build());
            }
        }
    }
}

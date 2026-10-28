package app.bunkclub.mobile;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioManager;
import android.os.Build;
import android.os.IBinder;
import androidx.core.app.NotificationCompat;
import org.json.JSONArray;
import org.json.JSONObject;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;

public class BunkClubBackgroundService extends Service {

    public static final String SERVICE_CHANNEL_ID = "bunkclub_background_channel";
    private static final int SERVICE_NOTIF_ID = 8888;

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        createServiceNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        // Run as persistent foreground service so Android OS never kills it
        Notification notification = buildServiceNotification("BunkClub Sentinel Active", "Monitoring sessions for auto-mute and auto-unmute");
        startForeground(SERVICE_NOTIF_ID, notification);

        // Schedule all lecture alarms from stored preferences
        rescheduleAllAlarms();

        // Check if currently inside a period right now
        checkAndApplyCurrentHourMode();

        return START_STICKY;
    }

    private void createServiceNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                SERVICE_CHANNEL_ID,
                "BunkClub Background Sentinel",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Background monitoring for automatic class muting");
            channel.setShowBadge(false);
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    private Notification buildServiceNotification(String title, String text) {
        Intent openIntent = new Intent(this, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this,
            0,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
        );

        return new NotificationCompat.Builder(this, SERVICE_CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(text)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .build();
    }

    public void rescheduleAllAlarms() {
        SharedPreferences prefs = getSharedPreferences("BunkClubPrefs", Context.MODE_PRIVATE);
        String periodsJson = prefs.getString("saved_periods_json", "[]");
        AlarmManager alarmManager = (AlarmManager) getSystemService(Context.ALARM_SERVICE);
        if (alarmManager == null) return;

        try {
            JSONArray arr = new JSONArray(periodsJson);
            for (int i = 0; i < arr.length(); i++) {
                JSONObject p = arr.getJSONObject(i);
                int periodNum = p.optInt("periodNumber", i + 1);
                String startTime = p.optString("startTime");
                String endTime = p.optString("endTime");
                String subjectName = p.optString("subjectName", "Class");

                if (startTime != null && startTime.contains(":")) {
                    String[] sp = startTime.split(":");
                    Calendar calStart = Calendar.getInstance();
                    calStart.set(Calendar.HOUR_OF_DAY, Integer.parseInt(sp[0]));
                    calStart.set(Calendar.MINUTE, Integer.parseInt(sp[1]));
                    calStart.set(Calendar.SECOND, 0);

                    if (calStart.getTimeInMillis() > System.currentTimeMillis()) {
                        Intent startIntent = new Intent(this, BunkClubBroadcastReceiver.class);
                        startIntent.setAction(BunkClubBroadcastReceiver.ACTION_CLASS_START);
                        startIntent.putExtra("periodNumber", periodNum);
                        startIntent.putExtra("subjectName", subjectName);
                        PendingIntent piStart = PendingIntent.getBroadcast(
                            this,
                            periodNum * 200 + 10,
                            startIntent,
                            PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
                        );
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                            alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, calStart.getTimeInMillis(), piStart);
                        } else {
                            alarmManager.setExact(AlarmManager.RTC_WAKEUP, calStart.getTimeInMillis(), piStart);
                        }
                    }
                }

                if (endTime != null && endTime.contains(":")) {
                    String[] ep = endTime.split(":");
                    Calendar calEnd = Calendar.getInstance();
                    calEnd.set(Calendar.HOUR_OF_DAY, Integer.parseInt(ep[0]));
                    calEnd.set(Calendar.MINUTE, Integer.parseInt(ep[1]));
                    calEnd.set(Calendar.SECOND, 0);

                    if (calEnd.getTimeInMillis() > System.currentTimeMillis()) {
                        Intent endIntent = new Intent(this, BunkClubBroadcastReceiver.class);
                        endIntent.setAction(BunkClubBroadcastReceiver.ACTION_CLASS_END);
                        endIntent.putExtra("periodNumber", periodNum);
                        endIntent.putExtra("subjectName", subjectName);
                        PendingIntent piEnd = PendingIntent.getBroadcast(
                            this,
                            periodNum * 200 + 20,
                            endIntent,
                            PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
                        );
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                            alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, calEnd.getTimeInMillis(), piEnd);
                        } else {
                            alarmManager.setExact(AlarmManager.RTC_WAKEUP, calEnd.getTimeInMillis(), piEnd);
                        }
                    }
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void checkAndApplyCurrentHourMode() {
        SharedPreferences prefs = getSharedPreferences("BunkClubPrefs", Context.MODE_PRIVATE);
        String periodsJson = prefs.getString("saved_periods_json", "[]");
        String today = new SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(new Date());
        AudioManager audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);

        Calendar now = Calendar.getInstance();
        int nowMin = now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE);

        boolean insideActiveLecture = false;

        try {
            JSONArray arr = new JSONArray(periodsJson);
            for (int i = 0; i < arr.length(); i++) {
                JSONObject p = arr.getJSONObject(i);
                int periodNum = p.optInt("periodNumber", i + 1);
                String startTime = p.optString("startTime");
                String endTime = p.optString("endTime");

                if (startTime != null && endTime != null && startTime.contains(":") && endTime.contains(":")) {
                    String[] sp = startTime.split(":");
                    String[] ep = endTime.split(":");
                    int sMin = Integer.parseInt(sp[0]) * 60 + Integer.parseInt(sp[1]);
                    int eMin = Integer.parseInt(ep[0]) * 60 + Integer.parseInt(ep[1]);

                    if (nowMin >= sMin && nowMin < eMin) {
                        boolean isBunked = prefs.getBoolean("bunked_" + today + "_P" + periodNum, false);
                        if (!isBunked) {
                            insideActiveLecture = true;
                        }
                        break;
                    }
                }
            }

            if (audioManager != null) {
                if (insideActiveLecture) {
                    audioManager.setRingerMode(AudioManager.RINGER_MODE_VIBRATE);
                } else {
                    audioManager.setRingerMode(AudioManager.RINGER_MODE_NORMAL);
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}

package app.bunkclub.mobile;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioManager;
import android.os.Build;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;

@CapacitorPlugin(name = "ClassSilentMode")
public class ClassSilentPlugin extends Plugin {

    @PluginMethod
    public void setSilent(PluginCall call) {
        try {
            AudioManager audioManager = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
            if (audioManager != null) {
                // Strictly enforce VIBRATE / SILENT mode
                audioManager.setRingerMode(AudioManager.RINGER_MODE_VIBRATE);
            }
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    @PluginMethod
    public void setNormal(PluginCall call) {
        try {
            AudioManager audioManager = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
            if (audioManager != null) {
                // Strictly restore NORMAL audible mode
                audioManager.setRingerMode(AudioManager.RINGER_MODE_NORMAL);
            }
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    @PluginMethod
    public void markBunk(PluginCall call) {
        try {
            int periodNumber = call.getInt("periodNumber", 1);
            String date = call.getString("date");
            if (date == null) {
                date = new SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(new Date());
            }

            SharedPreferences prefs = getContext().getSharedPreferences("BunkClubPrefs", Context.MODE_PRIVATE);
            prefs.edit().putBoolean("bunked_" + date + "_P" + periodNumber, true).apply();

            // Immediately restore active normal ringer mode
            AudioManager audioManager = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
            if (audioManager != null) {
                audioManager.setRingerMode(AudioManager.RINGER_MODE_NORMAL);
            }

            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    @PluginMethod
    public void registerExtraClass(PluginCall call) {
        try {
            int periodNumber = call.getInt("periodNumber", 6);
            String subjectName = call.getString("subjectName", "Extra Class");
            String startTime = call.getString("startTime"); // e.g. "16:00"
            String endTime = call.getString("endTime");     // e.g. "17:00"
            String status = call.getString("status", "present");

            Context ctx = getContext();
            AudioManager audioManager = (AudioManager) ctx.getSystemService(Context.AUDIO_SERVICE);
            AlarmManager alarmManager = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);

            if ("present".equals(status)) {
                // Check if current time falls within this extra class right now
                Calendar now = Calendar.getInstance();
                int nowMin = now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE);

                if (startTime != null && endTime != null && startTime.contains(":") && endTime.contains(":")) {
                    String[] sp = startTime.split(":");
                    String[] ep = endTime.split(":");
                    int sMin = Integer.parseInt(sp[0]) * 60 + Integer.parseInt(sp[1]);
                    int eMin = Integer.parseInt(ep[0]) * 60 + Integer.parseInt(ep[1]);

                    if (nowMin >= sMin && nowMin < eMin) {
                        // Class is happening right now! Strictly silence phone immediately!
                        if (audioManager != null) {
                            audioManager.setRingerMode(AudioManager.RINGER_MODE_VIBRATE);
                        }
                    }

                    // Schedule future start alarm if it hasn't started yet
                    if (alarmManager != null && sMin > nowMin) {
                        Calendar calStart = Calendar.getInstance();
                        calStart.set(Calendar.HOUR_OF_DAY, Integer.parseInt(sp[0]));
                        calStart.set(Calendar.MINUTE, Integer.parseInt(sp[1]));
                        calStart.set(Calendar.SECOND, 0);

                        Intent startIntent = new Intent(ctx, ClassAlarmReceiver.class);
                        startIntent.setAction(ClassAlarmReceiver.ACTION_CLASS_START);
                        startIntent.putExtra("periodNumber", periodNumber);
                        startIntent.putExtra("subjectName", subjectName);
                        PendingIntent piStart = PendingIntent.getBroadcast(
                            ctx,
                            9000 + periodNumber,
                            startIntent,
                            PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
                        );
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                            alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, calStart.getTimeInMillis(), piStart);
                        } else {
                            alarmManager.setExact(AlarmManager.RTC_WAKEUP, calStart.getTimeInMillis(), piStart);
                        }
                    }

                    // Schedule end alarm
                    if (alarmManager != null && eMin > nowMin) {
                        Calendar calEnd = Calendar.getInstance();
                        calEnd.set(Calendar.HOUR_OF_DAY, Integer.parseInt(ep[0]));
                        calEnd.set(Calendar.MINUTE, Integer.parseInt(ep[1]));
                        calEnd.set(Calendar.SECOND, 0);

                        Intent endIntent = new Intent(ctx, ClassAlarmReceiver.class);
                        endIntent.setAction(ClassAlarmReceiver.ACTION_CLASS_END);
                        endIntent.putExtra("periodNumber", periodNumber);
                        endIntent.putExtra("subjectName", subjectName);
                        PendingIntent piEnd = PendingIntent.getBroadcast(
                            ctx,
                            9500 + periodNumber,
                            endIntent,
                            PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
                        );
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                            alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, calEnd.getTimeInMillis(), piEnd);
                        } else {
                            alarmManager.setExact(AlarmManager.RTC_WAKEUP, calEnd.getTimeInMillis(), piEnd);
                        }
                    }
                } else {
                    // No times specified: immediately silence if attending right now
                    if (audioManager != null) {
                        audioManager.setRingerMode(AudioManager.RINGER_MODE_VIBRATE);
                    }
                }
            } else {
                // If extra class is bunked or cancelled, ensure ringer is normal
                if (audioManager != null) {
                    audioManager.setRingerMode(AudioManager.RINGER_MODE_NORMAL);
                }
            }

            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    @PluginMethod
    public void scheduleLectureAlarms(PluginCall call) {
        try {
            JSArray periods = call.getArray("periods");
            if (periods == null || periods.length() == 0) {
                call.resolve();
                return;
            }

            Context ctx = getContext();
            AlarmManager alarmManager = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
            if (alarmManager == null) {
                call.resolve();
                return;
            }

            for (int i = 0; i < periods.length(); i++) {
                JSObject p = JSObject.fromJSONObject(periods.getJSONObject(i));
                int periodNum = p.optInt("periodNumber", i + 1);
                String startTime = p.optString("startTime");
                String endTime = p.optString("endTime");
                String subjectName = p.optString("subjectName", "Class");

                if (startTime != null && startTime.contains(":")) {
                    String[] parts = startTime.split(":");
                    int sh = Integer.parseInt(parts[0]);
                    int sm = Integer.parseInt(parts[1]);

                    Calendar calStart = Calendar.getInstance();
                    calStart.set(Calendar.HOUR_OF_DAY, sh);
                    calStart.set(Calendar.MINUTE, sm);
                    calStart.set(Calendar.SECOND, 0);

                    if (calStart.getTimeInMillis() > System.currentTimeMillis()) {
                        Intent startIntent = new Intent(ctx, ClassAlarmReceiver.class);
                        startIntent.setAction(ClassAlarmReceiver.ACTION_CLASS_START);
                        startIntent.putExtra("periodNumber", periodNum);
                        startIntent.putExtra("subjectName", subjectName);
                        PendingIntent piStart = PendingIntent.getBroadcast(
                            ctx,
                            periodNum * 10 + 1,
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
                    String[] parts = endTime.split(":");
                    int eh = Integer.parseInt(parts[0]);
                    int em = Integer.parseInt(parts[1]);

                    Calendar calEnd = Calendar.getInstance();
                    calEnd.set(Calendar.HOUR_OF_DAY, eh);
                    calEnd.set(Calendar.MINUTE, em);
                    calEnd.set(Calendar.SECOND, 0);

                    if (calEnd.getTimeInMillis() > System.currentTimeMillis()) {
                        Intent endIntent = new Intent(ctx, ClassAlarmReceiver.class);
                        endIntent.setAction(ClassAlarmReceiver.ACTION_CLASS_END);
                        endIntent.putExtra("periodNumber", periodNum);
                        endIntent.putExtra("subjectName", subjectName);
                        PendingIntent piEnd = PendingIntent.getBroadcast(
                            ctx,
                            periodNum * 10 + 2,
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

            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }
}

package app.bunkclub.mobile;

import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

@CapacitorPlugin(name = "BunkClubBackground")
public class BunkClubBackgroundPlugin extends Plugin {

    @PluginMethod
    public void startBackgroundMonitoring(PluginCall call) {
        try {
            Context ctx = getContext();
            JSArray periods = call.getArray("periods");

            if (periods != null) {
                SharedPreferences prefs = ctx.getSharedPreferences("BunkClubPrefs", Context.MODE_PRIVATE);
                prefs.edit().putString("saved_periods_json", periods.toString()).apply();
            }

            Intent serviceIntent = new Intent(ctx, BunkClubBackgroundService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ctx.startForegroundService(serviceIntent);
            } else {
                ctx.startService(serviceIntent);
            }

            JSObject ret = new JSObject();
            ret.put("started", true);
            call.resolve(ret);
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

            Context ctx = getContext();
            SharedPreferences prefs = ctx.getSharedPreferences("BunkClubPrefs", Context.MODE_PRIVATE);
            prefs.edit().putBoolean("bunked_" + date + "_P" + periodNumber, true).apply();

            // Immediately unmute phone to active audible mode
            applyUnmute(ctx);

            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    @PluginMethod
    public void markPresent(PluginCall call) {
        try {
            int periodNumber = call.getInt("periodNumber", 1);
            String date = call.getString("date");
            if (date == null) {
                date = new SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(new Date());
            }

            Context ctx = getContext();
            SharedPreferences prefs = ctx.getSharedPreferences("BunkClubPrefs", Context.MODE_PRIVATE);
            // Clear bunked flag, mark present
            prefs.edit().remove("bunked_" + date + "_P" + periodNumber)
                 .putBoolean("present_" + date + "_P" + periodNumber, true).apply();

            // Mute phone because student is present in lecture/lab
            applyMute(ctx);

            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    @PluginMethod
    public void muteNow(PluginCall call) {
        try {
            applyMute(getContext());
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    @PluginMethod
    public void unmuteNow(PluginCall call) {
        try {
            applyUnmute(getContext());
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    public static void applyMute(Context ctx) {
        if (ctx == null) return;
        try {
            AudioManager audioManager = (AudioManager) ctx.getSystemService(Context.AUDIO_SERVICE);
            if (audioManager == null) return;

            try {
                audioManager.setRingerMode(AudioManager.RINGER_MODE_VIBRATE);
            } catch (Exception e) {
                // If DND access restricted, fallback to volume streams
            }

            try {
                audioManager.setStreamVolume(AudioManager.STREAM_RING, 0, 0);
                audioManager.setStreamVolume(AudioManager.STREAM_NOTIFICATION, 0, 0);
            } catch (Exception ignored) {}
        } catch (Exception ignored) {}
    }

    public static void applyUnmute(Context ctx) {
        if (ctx == null) return;
        try {
            AudioManager audioManager = (AudioManager) ctx.getSystemService(Context.AUDIO_SERVICE);
            if (audioManager == null) return;

            try {
                audioManager.setRingerMode(AudioManager.RINGER_MODE_NORMAL);
            } catch (Exception ignored) {}

            try {
                int maxRing = audioManager.getStreamMaxVolume(AudioManager.STREAM_RING);
                int targetRing = Math.max(1, maxRing * 2 / 3);
                audioManager.setStreamVolume(AudioManager.STREAM_RING, targetRing, 0);

                int maxNotif = audioManager.getStreamMaxVolume(AudioManager.STREAM_NOTIFICATION);
                int targetNotif = Math.max(1, maxNotif * 2 / 3);
                audioManager.setStreamVolume(AudioManager.STREAM_NOTIFICATION, targetNotif, 0);
            } catch (Exception ignored) {}
        } catch (Exception ignored) {}
    }

    @PluginMethod
    public void requestPermissions(PluginCall call) {
        try {
            Context ctx = getContext();
            String pkg = ctx.getPackageName();
            PowerManager pm = (PowerManager) ctx.getSystemService(Context.POWER_SERVICE);
            NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && pm != null) {
                if (!pm.isIgnoringBatteryOptimizations(pkg)) {
                    Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                    intent.setData(Uri.parse("package:" + pkg));
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    ctx.startActivity(intent);
                }
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && nm != null) {
                if (!nm.isNotificationPolicyAccessGranted()) {
                    Intent intent = new Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS);
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    ctx.startActivity(intent);
                }
            }

            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }
}

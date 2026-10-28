package app.bunkclub.mobile;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    public static final String CHANNEL_ID = "bunkclub_alerts";
    private static final int NOTIF_REQ_CODE = 999;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ClassSilentPlugin.class);
        super.onCreate(savedInstanceState);
        
        // 1. Create high-priority notification channel immediately upon launch
        createNotificationChannel();

        // 2. Automatically grant/request notification permission on startup
        autoEnableNotifications();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "BunkClub Attendance & Class Alerts",
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Daily morning schedules, period check-ins and bunk alerts");
            channel.enableVibration(true);
            channel.setShowBadge(true);

            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    private void autoEnableNotifications() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(
                    this,
                    new String[]{Manifest.permission.POST_NOTIFICATIONS},
                    NOTIF_REQ_CODE
                );
            }
        }
    }
}

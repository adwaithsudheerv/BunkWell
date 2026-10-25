package app.bunkclub.mobile;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

public class BunkWidgetProvider extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        SharedPreferences prefs = context.getSharedPreferences("BunkClubWidgetPrefs", Context.MODE_PRIVATE);
        
        String heroNum = prefs.getString("bunk_count", "02");
        String bunkStatus = prefs.getString("bunk_status", "REMAINING");
        String targetText = prefs.getString("target_text", "85.4% • Target 80%");
        String nextBadge = prefs.getString("next_badge", "UPCOMING • P1");
        String periodTime = prefs.getString("period_time", "08:50 AM");
        String subjectName = prefs.getString("subject_name", "DBMS");
        String subQueue = prefs.getString("sub_queue", "Then: P2 MAOM → Java Lab");

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.bunk_widget_layout);
        
        views.setTextViewText(R.id.widget_hero_num, heroNum);
        views.setTextViewText(R.id.widget_bunk_status, bunkStatus);
        views.setTextViewText(R.id.widget_target_badge, targetText);
        views.setTextViewText(R.id.widget_next_badge, nextBadge);
        views.setTextViewText(R.id.widget_period_time, periodTime);
        views.setTextViewText(R.id.widget_subject_name, subjectName);
        views.setTextViewText(R.id.widget_sub_queue, subQueue);

        // Click on widget opens main application
        Intent intent = new Intent(context, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            context,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_container, pendingIntent);

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }
}

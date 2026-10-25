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
        String bunkSummary = prefs.getString("bunk_summary", "You can bunk 2 classes today 🎉");
        String periods = prefs.getString("today_periods", "P1: DBMS • P2: Java • P5: Lab");

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.bunk_widget_layout);
        views.setTextViewText(R.id.widget_bunk_text, bunkSummary);
        views.setTextViewText(R.id.widget_periods_text, periods);

        // Click on widget opens app
        Intent intent = new Intent(context, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_container, pendingIntent);

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }
}

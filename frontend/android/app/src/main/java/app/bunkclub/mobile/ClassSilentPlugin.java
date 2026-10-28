package app.bunkclub.mobile;

import android.content.Context;
import android.media.AudioManager;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ClassSilentMode")
public class ClassSilentPlugin extends Plugin {

    @PluginMethod
    public void setSilent(PluginCall call) {
        try {
            AudioManager audioManager = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
            if (audioManager != null) {
                // Switch to Vibrate / Silent mode during lecture
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
                // Restore Normal audible ringer during breaks and after classes
                audioManager.setRingerMode(AudioManager.RINGER_MODE_NORMAL);
            }
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }
}

package documentreadersdk.example

import android.app.Application
import android.util.Log
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.load
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.soloader.SoLoader

class MainApplication : Application(), ReactApplication {

  override val reactNativeHost: ReactNativeHost =
      object : DefaultReactNativeHost(this) {
        override fun getPackages(): List<ReactPackage> =
            PackageList(this).packages.apply {
              // Packages that cannot be autolinked yet can be added manually here, for example:
              // add(MyReactNativePackage())
            }

        override fun getJSMainModuleName(): String = "index"

        override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

        override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
        override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
      }

  override val reactHost: ReactHost
    get() = getDefaultReactHost(applicationContext, reactNativeHost)

  override fun onCreate() {
    super.onCreate()
    preloadDocumentReaderNativeLibs()
    SoLoader.init(this, false)
    if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
      load()
    }
  }

  /**
   * Load DocSDK engine deps before RN/Hermes.
   * Load DocumentEngine before DocSDK: on API 26, loading DocSDK first can leave the
   * linker unable to bind DocumentEngine's own FPCore* data symbols (self-reloc).
   */
  private fun preloadDocumentReaderNativeLibs() {
    val libDir = applicationInfo.nativeLibraryDir
    val libs =
        arrayOf(
            "c++_shared",
            "DocumentEngine",
            "dcrp",
            "dcrxhfc",
            "DocSDK",
        )
    for (name in libs) {
      // Prefer absolute path when libs are extracted (useLegacyPackaging=true).
      val path = "$libDir/lib$name.so"
      try {
        if (java.io.File(path).exists()) {
          System.load(path)
          Log.i(TAG, "preload ok path: lib$name.so")
        } else {
          System.loadLibrary(name)
          Log.i(TAG, "preload ok: $name")
        }
      } catch (e: UnsatisfiedLinkError) {
        Log.w(TAG, "preload path failed: lib$name.so", e)
        try {
          System.loadLibrary(name)
          Log.i(TAG, "preload ok: $name")
        } catch (e2: UnsatisfiedLinkError) {
          Log.e(TAG, "preload failed: lib$name.so", e2)
        }
      }
    }
  }

  companion object {
    private const val TAG = "DocReaderPreload"
  }
}

package com.craftbase.preview;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.*;
import android.widget.*;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;

/** Minimal testing shell. All app data and authorization remain on the web server. */
public final class MainActivity extends Activity {
  private WebView web;
  private LinearLayout error;
  private ProgressBar progress;
  private String appUrl;
  private String appOrigin;
  private String platformOrigin;
  private ValueCallback<Uri[]> fileResult;

  private static String origin(String value) {
    Uri uri = Uri.parse(value);
    return uri.getScheme() + "://" + uri.getAuthority();
  }

  private boolean navigate(String value) {
    Uri uri = Uri.parse(value);
    String scheme = uri.getScheme();
    if ("https".equals(scheme) && (appOrigin.equals(origin(value)) || platformOrigin.equals(origin(value)))) return false;
    if ("https".equals(scheme) || "http".equals(scheme) || "mailto".equals(scheme) || "tel".equals(scheme)) {
      try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); }
      catch (Exception ignored) { Toast.makeText(this, "No app can open this link.", Toast.LENGTH_SHORT).show(); }
    }
    return true;
  }

  @Override public void onCreate(Bundle state) {
    super.onCreate(state);
    try (InputStream input = getAssets().open("deployment.json")) {
      ByteArrayOutputStream bytes = new ByteArrayOutputStream();
      byte[] buffer = new byte[4096];
      for (int n; (n = input.read(buffer)) != -1;) bytes.write(buffer, 0, n);
      JSONObject config = new JSONObject(bytes.toString("UTF-8"));
      appUrl = config.getString("appUrl");
      appOrigin = origin(appUrl);
      platformOrigin = origin(config.getString("platformUrl"));
    } catch (Exception invalid) { finish(); return; }

    LinearLayout root = new LinearLayout(this);
    root.setOrientation(LinearLayout.VERTICAL);
    root.setBackgroundColor(0xffffffff);
    root.setOnApplyWindowInsetsListener((view, insets) -> {
      if (Build.VERSION.SDK_INT >= 30) {
        android.graphics.Insets safe = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
        view.setPadding(safe.left, safe.top, safe.right, safe.bottom);
      } else view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(), insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
      return insets;
    });
    progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
    root.addView(progress, new LinearLayout.LayoutParams(-1, 6));
    error = new LinearLayout(this);
    error.setOrientation(LinearLayout.VERTICAL);
    error.setPadding(32, 32, 32, 32);
    TextView message = new TextView(this);
    message.setText("Couldn't load this app. Check your connection and make sure the app is still published.");
    Button retry = new Button(this);
    retry.setText("Try again");
    retry.setOnClickListener(v -> { error.setVisibility(View.GONE); web.setVisibility(View.VISIBLE); web.loadUrl(appUrl); });
    error.addView(message); error.addView(retry); error.setVisibility(View.GONE);
    root.addView(error);
    web = new WebView(this);
    root.addView(web, new LinearLayout.LayoutParams(-1, 0, 1));
    setContentView(root);
    WebSettings settings = web.getSettings();
    settings.setJavaScriptEnabled(true);
    settings.setDomStorageEnabled(true);
    settings.setAllowFileAccess(false);
    settings.setAllowContentAccess(false);
    settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
    settings.setSafeBrowsingEnabled(true);
    settings.setMediaPlaybackRequiresUserGesture(true);
    settings.setSupportMultipleWindows(false);
    CookieManager.getInstance().setAcceptThirdPartyCookies(web, false);
    web.setWebViewClient(new WebViewClient() {
      @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        return request.isForMainFrame() && navigate(request.getUrl().toString());
      }
      @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError detail) {
        if (request.isForMainFrame()) showError();
      }
      @Override public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse response) {
        if (request.isForMainFrame()) showError();
      }
      @Override public void onReceivedSslError(WebView view, android.webkit.SslErrorHandler handler, android.net.http.SslError detail) {
        handler.cancel(); showError();
      }
    });
    web.setWebChromeClient(new WebChromeClient() {
      @Override public void onProgressChanged(WebView view, int value) {
        progress.setProgress(value); progress.setVisibility(value < 100 ? View.VISIBLE : View.GONE);
      }
      @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
        if (fileResult != null) fileResult.onReceiveValue(null);
        fileResult = callback;
        Intent picker = new Intent(Intent.ACTION_GET_CONTENT);
        picker.addCategory(Intent.CATEGORY_OPENABLE);
        picker.setType("*/*");
        picker.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE);
        try { startActivityForResult(Intent.createChooser(picker, "Choose a file"), 41); }
        catch (Exception unavailable) { fileResult.onReceiveValue(null); fileResult = null; }
        return true;
      }
    });
    web.setDownloadListener((url, agent, disposition, mime, size) -> {
      if (url.startsWith("https://")) {
        try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); } catch (Exception ignored) { }
      }
    });
    if (state == null || web.restoreState(state) == null) web.loadUrl(appUrl);
  }

  private void showError() { error.setVisibility(View.VISIBLE); web.setVisibility(View.GONE); progress.setVisibility(View.GONE); }
  @Override protected void onSaveInstanceState(Bundle state) { web.saveState(state); super.onSaveInstanceState(state); }
  @Override protected void onActivityResult(int request, int result, Intent data) {
    super.onActivityResult(request, result, data);
    if (request == 41 && fileResult != null) {
      fileResult.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result, data)); fileResult = null;
    }
  }
  @Override public void onBackPressed() { if (web.canGoBack()) web.goBack(); else super.onBackPressed(); }
  @Override protected void onDestroy() {
    if (fileResult != null) fileResult.onReceiveValue(null);
    if (web != null) web.destroy();
    super.onDestroy();
  }
}

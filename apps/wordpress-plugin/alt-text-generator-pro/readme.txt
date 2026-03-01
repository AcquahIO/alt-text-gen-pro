=== Alt Text Generator Pro ===
Contributors: alttextgeneratorpro
Requires at least: 6.0
Tested up to: 6.7
Requires PHP: 7.4
Stable tag: 0.1.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Generate image alt text from WordPress using your Alt Text Generator Pro account.

== Description ==

Alt Text Generator Pro connects your WordPress site to the Alt Text Generator Pro backend.

This starter version includes:
- Plugin settings for backend base URL, access token, and timeout.
- OAuth-style account connect flow in WordPress admin (redirect + one-time code exchange).
- REST endpoint to generate alt text:
  - `POST /wp-json/alt-text-generator-pro/v1/generate`
- Request forwarding to your central backend `/generate-alt-text`.

== Installation ==

1. Upload this plugin folder to `/wp-content/plugins/`.
2. Activate **Alt Text Generator Pro** in WordPress admin.
3. Go to **Settings > Alt Text Generator Pro**.
4. Enter:
   - Backend base URL (example: `https://api.alttextgeneratorpro.com`)
   - Click **Connect account** and complete sign in on Alt Text Generator Pro
5. Save settings.

== Usage ==

Send a POST request to:

`/wp-json/alt-text-generator-pro/v1/generate`

Example payload:

`{"image_url":"https://example.com/image.jpg","context":{"pageTitle":"Product page"}}`

== Backend setup note ==

For OAuth account connect, configure backend env `AUTH_ALLOWED_REDIRECT_ORIGINS`
to include your WordPress admin origin.

== Privacy ==

This plugin sends image and context payloads to your configured Alt Text Generator Pro backend.
Do not use this plugin unless your site privacy policy discloses that data flow.

== Changelog ==

= 0.1.0 =
* Initial starter release.

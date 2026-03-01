<?php

if (!defined('ABSPATH')) {
    exit;
}

final class ATGP_Plugin {
    private static $instance = null;

    private const OPTION_GROUP = 'atgp_options_group';
    private const OPTION_BASE_URL = 'atgp_base_url';
    private const OPTION_ACCESS_TOKEN = 'atgp_access_token';
    private const OPTION_ACCOUNT_EMAIL = 'atgp_account_email';
    private const OPTION_TIMEOUT_SECONDS = 'atgp_timeout_seconds';
    private const SETTINGS_SLUG = 'alt-text-generator-pro';
    private const REST_NAMESPACE = 'alt-text-generator-pro/v1';
    private const REQUIRED_CAPABILITY = 'upload_files';
    private const NOTICE_QUERY_KEY = 'atgp_notice';
    private const MESSAGE_QUERY_KEY = 'atgp_message';
    private const STATE_TRANSIENT_PREFIX = 'atgp_oauth_state_';

    public static function instance(): self {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        add_action('admin_menu', array($this, 'register_admin_menu'));
        add_action('admin_init', array($this, 'register_settings'));
        add_action('rest_api_init', array($this, 'register_rest_routes'));
        add_action('admin_post_atgp_auth_start', array($this, 'handle_auth_start'));
        add_action('admin_post_atgp_auth_callback', array($this, 'handle_auth_callback'));
        add_action('admin_post_atgp_sign_out', array($this, 'handle_sign_out'));
        add_action('admin_notices', array($this, 'render_admin_notice'));
        add_filter('plugin_action_links_' . plugin_basename(dirname(__DIR__) . '/alt-text-generator-pro.php'), array($this, 'add_settings_link'));
    }

    public function add_settings_link(array $links): array {
        $settings_url = admin_url('options-general.php?page=' . self::SETTINGS_SLUG);
        $settings_link = sprintf(
            '<a href="%s">%s</a>',
            esc_url($settings_url),
            esc_html__('Settings', 'alt-text-generator-pro')
        );
        array_unshift($links, $settings_link);
        return $links;
    }

    public function register_admin_menu(): void {
        add_options_page(
            __('Alt Text Generator Pro', 'alt-text-generator-pro'),
            __('Alt Text Generator Pro', 'alt-text-generator-pro'),
            'manage_options',
            self::SETTINGS_SLUG,
            array($this, 'render_settings_page')
        );
    }

    public function register_settings(): void {
        register_setting(
            self::OPTION_GROUP,
            self::OPTION_BASE_URL,
            array(
                'type' => 'string',
                'sanitize_callback' => array($this, 'sanitize_base_url'),
                'default' => '',
            )
        );

        register_setting(
            self::OPTION_GROUP,
            self::OPTION_ACCESS_TOKEN,
            array(
                'type' => 'string',
                'sanitize_callback' => array($this, 'sanitize_access_token'),
                'default' => '',
            )
        );

        register_setting(
            self::OPTION_GROUP,
            self::OPTION_TIMEOUT_SECONDS,
            array(
                'type' => 'integer',
                'sanitize_callback' => array($this, 'sanitize_timeout'),
                'default' => 25,
            )
        );

        add_settings_section(
            'atgp_api_section',
            __('API Configuration', 'alt-text-generator-pro'),
            '__return_false',
            self::SETTINGS_SLUG
        );

        add_settings_field(
            self::OPTION_BASE_URL,
            __('Backend base URL', 'alt-text-generator-pro'),
            array($this, 'render_base_url_field'),
            self::SETTINGS_SLUG,
            'atgp_api_section'
        );

        add_settings_field(
            self::OPTION_ACCESS_TOKEN,
            __('Access token', 'alt-text-generator-pro'),
            array($this, 'render_access_token_field'),
            self::SETTINGS_SLUG,
            'atgp_api_section'
        );

        add_settings_field(
            self::OPTION_TIMEOUT_SECONDS,
            __('Request timeout (seconds)', 'alt-text-generator-pro'),
            array($this, 'render_timeout_field'),
            self::SETTINGS_SLUG,
            'atgp_api_section'
        );
    }

    public function sanitize_base_url($value): string {
        $url = esc_url_raw(trim((string) $value));
        return rtrim($url, '/');
    }

    public function sanitize_access_token($value): string {
        $token = trim((string) $value);
        return preg_replace('/\s+/', '', $token);
    }

    public function sanitize_timeout($value): int {
        $timeout = (int) $value;
        if ($timeout < 5) {
            return 5;
        }
        if ($timeout > 60) {
            return 60;
        }
        return $timeout;
    }

    public function render_base_url_field(): void {
        $value = (string) get_option(self::OPTION_BASE_URL, '');
        printf(
            '<input type="url" name="%s" value="%s" class="regular-text" placeholder="https://api.alttextgeneratorpro.com" />',
            esc_attr(self::OPTION_BASE_URL),
            esc_attr($value)
        );
        echo '<p class="description">' . esc_html__('Base URL for your Alt Text Generator Pro backend.', 'alt-text-generator-pro') . '</p>';
    }

    public function render_access_token_field(): void {
        $value = (string) get_option(self::OPTION_ACCESS_TOKEN, '');
        printf(
            '<input type="password" name="%s" value="%s" class="regular-text" autocomplete="off" />',
            esc_attr(self::OPTION_ACCESS_TOKEN),
            esc_attr($value)
        );
        echo '<p class="description">' . esc_html__('Use an account access token from Alt Text Generator Pro.', 'alt-text-generator-pro') . '</p>';
    }

    public function render_timeout_field(): void {
        $value = (int) get_option(self::OPTION_TIMEOUT_SECONDS, 25);
        printf(
            '<input type="number" min="5" max="60" name="%s" value="%d" class="small-text" />',
            esc_attr(self::OPTION_TIMEOUT_SECONDS),
            $value
        );
    }

    public function render_settings_page(): void {
        if (!current_user_can('manage_options')) {
            wp_die(esc_html__('You do not have permission to access this page.', 'alt-text-generator-pro'));
        }
        $base_url = (string) get_option(self::OPTION_BASE_URL, '');
        $saved_token = (string) get_option(self::OPTION_ACCESS_TOKEN, '');
        $account_email = (string) get_option(self::OPTION_ACCOUNT_EMAIL, '');
        $is_connected = $saved_token !== '';
        ?>
        <div class="wrap">
            <h1><?php echo esc_html__('Alt Text Generator Pro', 'alt-text-generator-pro'); ?></h1>
            <p><?php echo esc_html__('Configure backend access for WordPress image alt text generation.', 'alt-text-generator-pro'); ?></p>
            <div style="max-width: 880px; background: #fff; border: 1px solid #dcdcdc; border-radius: 8px; padding: 16px; margin: 16px 0;">
                <h2 style="margin-top: 0;"><?php echo esc_html__('Account connection', 'alt-text-generator-pro'); ?></h2>
                <?php if ($is_connected) : ?>
                    <p>
                        <?php
                        printf(
                            esc_html__('Connected as %s', 'alt-text-generator-pro'),
                            $account_email !== '' ? esc_html($account_email) : esc_html__('(email unavailable)', 'alt-text-generator-pro')
                        );
                        ?>
                    </p>
                    <form action="<?php echo esc_url(admin_url('admin-post.php')); ?>" method="post">
                        <?php wp_nonce_field('atgp_sign_out'); ?>
                        <input type="hidden" name="action" value="atgp_sign_out" />
                        <?php submit_button(__('Sign out', 'alt-text-generator-pro'), 'secondary', 'submit', false); ?>
                    </form>
                <?php else : ?>
                    <p><?php echo esc_html__('Connect your existing Alt Text Generator Pro account.', 'alt-text-generator-pro'); ?></p>
                    <form action="<?php echo esc_url(admin_url('admin-post.php')); ?>" method="post" style="display: grid; gap: 10px; max-width: 440px;">
                        <?php wp_nonce_field('atgp_auth_start'); ?>
                        <input type="hidden" name="action" value="atgp_auth_start" />
                        <?php
                        submit_button(
                            __('Connect account', 'alt-text-generator-pro'),
                            'primary',
                            'submit',
                            false,
                            array('disabled' => $base_url === '')
                        );
                        ?>
                        <?php if ($base_url === '') : ?>
                            <p class="description"><?php echo esc_html__('Set backend base URL first, then connect account.', 'alt-text-generator-pro'); ?></p>
                        <?php else : ?>
                            <p class="description"><?php echo esc_html__('You will sign in on Alt Text Generator Pro and return here automatically.', 'alt-text-generator-pro'); ?></p>
                        <?php endif; ?>
                    </form>
                <?php endif; ?>
            </div>
            <form action="options.php" method="post">
                <?php
                settings_fields(self::OPTION_GROUP);
                do_settings_sections(self::SETTINGS_SLUG);
                submit_button(__('Save settings', 'alt-text-generator-pro'));
                ?>
            </form>
            <hr />
            <h2><?php echo esc_html__('REST endpoint', 'alt-text-generator-pro'); ?></h2>
            <p>
                <code><?php echo esc_html(rest_url(self::REST_NAMESPACE . '/generate')); ?></code>
            </p>
            <p><?php echo esc_html__('POST with image_url or image_base64 to generate alt text.', 'alt-text-generator-pro'); ?></p>
        </div>
        <?php
    }

    public function handle_auth_start(): void {
        if (!current_user_can('manage_options')) {
            wp_die(esc_html__('You do not have permission to access this action.', 'alt-text-generator-pro'));
        }
        check_admin_referer('atgp_auth_start');

        $base_url = (string) get_option(self::OPTION_BASE_URL, '');
        if ($base_url === '') {
            $this->redirect_with_notice('error', __('Set backend base URL before connecting account.', 'alt-text-generator-pro'));
        }

        $state = wp_generate_password(48, false, false);
        $state_key = $this->state_transient_key($state);
        set_transient(
            $state_key,
            array(
                'user_id' => get_current_user_id(),
                'created_at' => time(),
            ),
            10 * MINUTE_IN_SECONDS
        );

        $callback_url = add_query_arg(
            array('action' => 'atgp_auth_callback'),
            admin_url('admin-post.php')
        );
        $connect_url = add_query_arg(
            array(
                'redirect_uri' => $callback_url,
                'state' => $state,
                'client' => 'wordpress',
            ),
            rtrim($base_url, '/') . '/auth/start'
        );

        wp_redirect($connect_url);
        exit;
    }

    public function handle_auth_callback(): void {
        if (!current_user_can('manage_options')) {
            wp_die(esc_html__('You do not have permission to access this action.', 'alt-text-generator-pro'));
        }

        $base_url = (string) get_option(self::OPTION_BASE_URL, '');
        if ($base_url === '') {
            $this->redirect_with_notice('error', __('Plugin is not configured: backend URL is missing.', 'alt-text-generator-pro'));
        }

        $state = sanitize_text_field((string) wp_unslash($_GET['state'] ?? ''));
        $code = sanitize_text_field((string) wp_unslash($_GET['code'] ?? ''));
        if ($state === '' || $code === '') {
            $this->redirect_with_notice('error', __('Missing authorization response parameters.', 'alt-text-generator-pro'));
        }

        $state_key = $this->state_transient_key($state);
        $state_payload = get_transient($state_key);
        delete_transient($state_key);

        if (!is_array($state_payload) || !isset($state_payload['user_id']) || (int) $state_payload['user_id'] !== get_current_user_id()) {
            $this->redirect_with_notice('error', __('Invalid or expired authorization state.', 'alt-text-generator-pro'));
        }

        $response = wp_remote_post(
            rtrim($base_url, '/') . '/auth/exchange',
            array(
                'method' => 'POST',
                'headers' => array('Content-Type' => 'application/json'),
                'timeout' => 25,
                'body' => wp_json_encode(array('code' => $code)),
            )
        );

        if (is_wp_error($response)) {
            $this->redirect_with_notice('error', $response->get_error_message());
        }

        $status_code = (int) wp_remote_retrieve_response_code($response);
        $raw_body = (string) wp_remote_retrieve_body($response);
        $json = json_decode($raw_body, true);
        if ($status_code < 200 || $status_code >= 300) {
            $message = __('Unable to complete account connection.', 'alt-text-generator-pro');
            if (is_array($json) && !empty($json['error']) && is_string($json['error'])) {
                $message = $json['error'];
            } elseif (is_array($json) && !empty($json['message']) && is_string($json['message'])) {
                $message = $json['message'];
            }
            $this->redirect_with_notice('error', $message);
        }

        $access_token = is_array($json) && isset($json['accessToken']) && is_string($json['accessToken']) ? trim($json['accessToken']) : '';
        $user_email =
            is_array($json) && isset($json['user']) && is_array($json['user']) && isset($json['user']['email']) && is_string($json['user']['email'])
                ? trim($json['user']['email'])
                : '';

        if ($access_token === '') {
            $this->redirect_with_notice('error', __('Account connected but no access token was returned.', 'alt-text-generator-pro'));
        }

        update_option(self::OPTION_ACCESS_TOKEN, $access_token, false);
        update_option(self::OPTION_ACCOUNT_EMAIL, $user_email, false);
        $this->redirect_with_notice('success', __('Account connected successfully.', 'alt-text-generator-pro'));
    }

    public function handle_sign_out(): void {
        if (!current_user_can('manage_options')) {
            wp_die(esc_html__('You do not have permission to access this action.', 'alt-text-generator-pro'));
        }
        check_admin_referer('atgp_sign_out');

        update_option(self::OPTION_ACCESS_TOKEN, '', false);
        update_option(self::OPTION_ACCOUNT_EMAIL, '', false);
        $this->redirect_with_notice('success', __('Signed out.', 'alt-text-generator-pro'));
    }

    public function render_admin_notice(): void {
        if (!current_user_can('manage_options')) return;
        if (!isset($_GET['page']) || sanitize_key((string) wp_unslash($_GET['page'])) !== self::SETTINGS_SLUG) return;

        $notice_type = isset($_GET[self::NOTICE_QUERY_KEY]) ? sanitize_key((string) wp_unslash($_GET[self::NOTICE_QUERY_KEY])) : '';
        $message = isset($_GET[self::MESSAGE_QUERY_KEY]) ? sanitize_text_field((string) wp_unslash($_GET[self::MESSAGE_QUERY_KEY])) : '';

        if ($notice_type === '' || $message === '') return;

        $class = $notice_type === 'success' ? 'notice notice-success' : 'notice notice-error';
        printf('<div class="%s is-dismissible"><p>%s</p></div>', esc_attr($class), esc_html($message));
    }

    private function redirect_with_notice(string $type, string $message): void {
        $url = add_query_arg(
            array(
                'page' => self::SETTINGS_SLUG,
                self::NOTICE_QUERY_KEY => $type,
                self::MESSAGE_QUERY_KEY => $message,
            ),
            admin_url('options-general.php')
        );
        wp_safe_redirect($url);
        exit;
    }

    private function state_transient_key(string $state): string {
        return self::STATE_TRANSIENT_PREFIX . md5($state);
    }

    public function register_rest_routes(): void {
        register_rest_route(
            self::REST_NAMESPACE,
            '/generate',
            array(
                'methods' => WP_REST_Server::CREATABLE,
                'permission_callback' => array($this, 'can_generate'),
                'args' => array(
                    'image_url' => array('type' => 'string', 'required' => false),
                    'image_base64' => array('type' => 'string', 'required' => false),
                    'context' => array('type' => 'object', 'required' => false),
                    'language' => array('type' => 'string', 'required' => false),
                ),
                'callback' => array($this, 'handle_generate_request'),
            )
        );
    }

    public function can_generate(): bool {
        return current_user_can(self::REQUIRED_CAPABILITY);
    }

    public function handle_generate_request(WP_REST_Request $request) {
        $image_url = trim((string) $request->get_param('image_url'));
        $image_base64 = trim((string) $request->get_param('image_base64'));

        if ($image_url === '' && $image_base64 === '') {
            return new WP_Error(
                'atgp_missing_image',
                __('image_url or image_base64 is required.', 'alt-text-generator-pro'),
                array('status' => 400)
            );
        }

        $base_url = (string) get_option(self::OPTION_BASE_URL, '');
        $access_token = (string) get_option(self::OPTION_ACCESS_TOKEN, '');
        $timeout = (int) get_option(self::OPTION_TIMEOUT_SECONDS, 25);

        if ($base_url === '' || $access_token === '') {
            return new WP_Error(
                'atgp_not_configured',
                __('Plugin is not configured. Set backend URL and access token in Settings.', 'alt-text-generator-pro'),
                array('status' => 500)
            );
        }

        $context = $request->get_param('context');
        if (!is_array($context)) {
            $context = array();
        }
        $context['client_scope'] = 'wordpress';

        $payload = array_filter(
            array(
                'image_url' => $image_url !== '' ? $image_url : null,
                'image_base64' => $image_base64 !== '' ? $image_base64 : null,
                'context' => $context,
                'language' => $request->get_param('language'),
            ),
            static function ($value) {
                return $value !== null && $value !== '';
            }
        );

        $response = wp_remote_post(
            rtrim($base_url, '/') . '/generate-alt-text',
            array(
                'method' => 'POST',
                'headers' => array(
                    'Content-Type' => 'application/json',
                    'Authorization' => 'Bearer ' . $access_token,
                    'X-Client-Scope' => 'wordpress',
                ),
                'timeout' => $timeout,
                'body' => wp_json_encode($payload),
            )
        );

        if (is_wp_error($response)) {
            return new WP_Error(
                'atgp_request_failed',
                $response->get_error_message(),
                array('status' => 502)
            );
        }

        $status_code = (int) wp_remote_retrieve_response_code($response);
        $raw_body = (string) wp_remote_retrieve_body($response);
        $json = json_decode($raw_body, true);

        if ($status_code < 200 || $status_code >= 300) {
            $message = __('Alt text generation failed.', 'alt-text-generator-pro');
            if (is_array($json) && !empty($json['message']) && is_string($json['message'])) {
                $message = $json['message'];
            } elseif (is_array($json) && !empty($json['error']) && is_string($json['error'])) {
                $message = $json['error'];
            }
            return new WP_Error(
                'atgp_api_error',
                $message,
                array('status' => $status_code > 0 ? $status_code : 502, 'payload' => $json)
            );
        }

        return rest_ensure_response(
            array(
                'alt_text' => is_array($json) && isset($json['alt_text']) ? (string) $json['alt_text'] : '',
                'model' => is_array($json) && isset($json['model']) ? (string) $json['model'] : null,
            )
        );
    }
}

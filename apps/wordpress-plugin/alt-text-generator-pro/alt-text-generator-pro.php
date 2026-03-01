<?php
/**
 * Plugin Name: Alt Text Generator Pro
 * Plugin URI: https://alttextgeneratorpro.com
 * Description: Generate image alt text from WordPress using your Alt Text Generator Pro account.
 * Version: 0.1.0
 * Author: Alt Text Generator Pro
 * Requires at least: 6.0
 * Requires PHP: 7.4
 * Text Domain: alt-text-generator-pro
 */

if (!defined('ABSPATH')) {
    exit;
}

require_once plugin_dir_path(__FILE__) . 'includes/class-atgp-plugin.php';

ATGP_Plugin::instance();

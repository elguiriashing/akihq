package com.akipasa.akihq;

import java.net.URI;
import java.net.URISyntaxException;
import java.net.URLDecoder;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

/** AkiPasa master auth handoff, adapted to a fixed product origin and scheme.
 * Never forwards bearer tokens/fragments or accepts arbitrary callback origins.
 * The receiving web callback remains responsible for PKCE verification.
 */
final class AppAuthCallback {
    private static final Set<String> KEYS = Set.of("locale", "code", "next", "error", "error_code", "error_description");
    private AppAuthCallback() {}

    /** Mark a legacy verified HTTPS return as native exactly once. */
    static String nativeHttpsCallback(String value) {
        if (value == null || value.length() > 8192) return null;
        try {
            URI uri = new URI(value);
            if (!"https".equals(uri.getScheme()) || !"akihq.app".equals(uri.getRawAuthority())
                    || uri.getRawFragment() != null || uri.getRawPath() == null
                    || !uri.getRawPath().matches("/(en|es)/auth/callback")) return null;
            boolean android = false, nativeReturn = false;
            Set<String> seen = new java.util.HashSet<>();
            if (uri.getRawQuery() == null) return null;
            for (String pair : uri.getRawQuery().split("&", -1)) {
                String[] parts = pair.split("=", 2);
                String key = URLDecoder.decode(parts[0], "UTF-8");
                String item = URLDecoder.decode(parts.length == 2 ? parts[1] : "", "UTF-8");
                if (!seen.add(key)) return null;
                if ("android".equals(key)) android = "1".equals(item);
                if ("native".equals(key)) nativeReturn = "1".equals(item);
            }
            if (!android) return null;
            return nativeReturn ? value : value + "&native=1";
        } catch (URISyntaxException | IllegalArgumentException | java.io.UnsupportedEncodingException error) {
            return null;
        }
    }

    static String toWebUrl(String value) {
        if (value == null || value.length() > 8192) return null;
        try {
            URI uri = new URI(value);
            if (!"akihq".equals(uri.getScheme()) || !"auth".equals(uri.getRawAuthority())
                    || !"/callback".equals(uri.getRawPath()) || uri.getRawFragment() != null
                    || uri.getRawUserInfo() != null || uri.getPort() != -1) return null;
            Map<String, String> params = new LinkedHashMap<>();
            String query = uri.getRawQuery();
            if (query == null || query.isEmpty()) return null;
            for (String pair : query.split("&", -1)) {
                String[] parts = pair.split("=", 2);
                String key = URLDecoder.decode(parts[0], "UTF-8");
                String item = URLDecoder.decode(parts.length == 2 ? parts[1] : "", "UTF-8");
                if (!KEYS.contains(key) || params.putIfAbsent(key, item) != null || item.length() > 4096) return null;
            }
            if (params.getOrDefault("code", "").isBlank() && params.getOrDefault("error", "").isBlank()) return null;
            String locale = "en".equals(params.get("locale")) ? "en" : "es";
            StringBuilder url = new StringBuilder("https://akihq.app" + "/" + locale + "/auth/callback" + "?android=1&native=1");
            for (String key : new String[]{"code", "next", "error", "error_code", "error_description"}) {
                if (params.containsKey(key)) url.append('&').append(key).append('=')
                        .append(URLEncoder.encode(params.get(key), "UTF-8"));
            }
            return url.toString();
        } catch (URISyntaxException | IllegalArgumentException | java.io.UnsupportedEncodingException error) {
            return null;
        }
    }
}

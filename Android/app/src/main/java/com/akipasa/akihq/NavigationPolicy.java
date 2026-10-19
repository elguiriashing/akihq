package com.akipasa.akihq;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Locale;
import java.util.Set;

final class NavigationPolicy {
    private static final Set<String> INTERNAL_HOSTS = Set.of("akihq.app", "www.akihq.app");
    private static final Set<String> EXTERNAL_SCHEMES = Set.of(
            "https", "mailto", "tel", "sms", "geo", "market"
    );

    private NavigationPolicy() {}

    static boolean isInternal(String value) {
        URI uri = parse(value);
        if (uri == null || !"https".equals(normalize(uri.getScheme()))) return false;
        return INTERNAL_HOSTS.contains(normalize(uri.getHost()));
    }

    static boolean canOpenExternally(String value) {
        URI uri = parse(value);
        return uri != null && EXTERNAL_SCHEMES.contains(normalize(uri.getScheme()));
    }

    static boolean canDownload(String value) {
        URI uri = parse(value);
        if (uri == null || !"https".equals(normalize(uri.getScheme()))) return false;
        String host = normalize(uri.getHost());
        return INTERNAL_HOSTS.contains(host) || host.endsWith(".supabase.co");
    }

    private static URI parse(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            return new URI(value);
        } catch (URISyntaxException error) {
            return null;
        }
    }

    private static String normalize(String value) {
        return value == null ? "" : value.toLowerCase(Locale.ROOT);
    }
}

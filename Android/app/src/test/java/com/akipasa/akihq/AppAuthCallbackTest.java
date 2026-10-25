package com.akipasa.akihq;

import org.junit.Test;
import static org.junit.Assert.*;

public class AppAuthCallbackTest {
    @Test public void mapsOnlyToOwnFixedOriginWithNativeMarkers() {
        String result = AppAuthCallback.toWebUrl("akihq://auth/callback?locale=en&code=one%2Btwo&next=%2Fen%2Faccount");
        assertEquals("https://akihq.app/en/auth/callback?android=1&native=1&code=one%2Btwo&next=%2Fen%2Faccount", result);
        assertTrue(AppAuthCallback.toWebUrl("akihq://auth/callback?code=abc").startsWith("https://akihq.app/es/auth/callback?android=1&native=1"));
    }
    @Test public void cancellationReturnsToOwnWebCallback() {
        assertTrue(AppAuthCallback.toWebUrl("akihq://auth/callback?locale=es&error=access_denied&error_description=Cancelled%20by%20user").contains("error=access_denied&error_description=Cancelled+by+user"));
    }
    @Test public void rejectsCrossAppAndAmbiguousOrTokenCallbacks() {
        for (String value : new String[]{
            "otherapp://auth/callback?code=abc", "akihq://evil/callback?code=abc",
            "akihq://auth/callback/extra?code=abc", "akihq://user@auth/callback?code=abc",
            "akihq://auth:443/callback?code=abc", "akihq://auth/callback?code=abc#access_token=secret",
            "akihq://auth/callback?code=abc&code=second", "akihq://auth/callback?code=abc&access_token=secret",
            "akihq://auth/callback?code=abc&redirect=https%3A%2F%2Fevil.example", "akihq://auth/callback?locale=en",
            "akihq://auth/callback?code=", "akihq://auth/callback?code=%ZZ", "akihq://auth/%63allback?code=abc"}) assertNull(value, AppAuthCallback.toWebUrl(value));
        assertNull(AppAuthCallback.toWebUrl(null));
        assertNull(AppAuthCallback.toWebUrl("akihq://auth/callback?code=" + "x".repeat(9000)));
    }
}

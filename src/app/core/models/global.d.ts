// src/types/global.d.ts

interface Window {
    env: {
        client_id?: string;
        iam_url?: string;
        server_url?: string;
        show_wallet_url_test: string;
        procedures?: string;
        saveCredential?: string;
        credential_offer_url?: string;
        notification?: string;
        sign_credential_url?: string;
    };
}

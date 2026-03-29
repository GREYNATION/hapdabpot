import axios from 'axios';
import { config, log } from '../core/config.js';

interface TradovateCredentials {
    name: string;
    cid: string;
    sec: string;
    deviceId: string;
    appVersion: string;
}

export class TradovateClient {
    private isLiveUrl = 'https://live.tradovateapi.com/v1';
    private demoUrl = 'https://demo.tradovateapi.com/v1';
    private baseUrl: string;
    
    // Auth State
    private token: string | null = null;
    private tokenExpiration: number = 0;
    
    // Account State
    public accountId: number | null = null;
    public deviceId: string;

    constructor(private useLive: boolean = false) {
        this.baseUrl = useLive ? this.isLiveUrl : this.demoUrl;
        
        // Tradovate requires a unique Device ID per session. We generate a random one if not provided.
        this.deviceId = process.env.TRADOVATE_DEVICE_ID || 'HapdaBot-' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Authenticate with Tradovate to get an OAuth Access Token.
     */
    public async authenticate(): Promise<boolean> {
        try {
            const username = process.env.TRADOVATE_USERNAME;
            const password = process.env.TRADOVATE_PASSWORD;
            const cid = process.env.TRADOVATE_CID;
            const sec = process.env.TRADOVATE_API_SECRET;

            if (!username || !password || !cid || !sec) {
                log("[tradovate] Missing authentication credentials in environment variables.", "error");
                return false;
            }

            log(`[tradovate] Attempting OAuth authentication against ${this.useLive ? 'LIVE' : 'DEMO'} API...`);

            const response = await axios.post(`${this.baseUrl}/auth/accesstokenrequest`, {
                name: username,
                password: password,
                appId: 'Sample App', // Tradovate allows loose app names for some credentials, or replace with 'HapdaBot'
                appVersion: '1.0',
                cid: cid,
                sec: sec,
                deviceId: this.deviceId
            });

            this.token = response.data.accessToken;
            // Token usually expires in 2 hours. Subtract 5 minutes for safety.
            const expiresTime = new Date(response.data.expirationTime).getTime();
            this.tokenExpiration = expiresTime - (5 * 60 * 1000); 

            log(`[tradovate] Authentication successful! Token expires at ${new Date(this.tokenExpiration).toLocaleTimeString()}`);
            
            // Immediately fetch the default Account ID to use for orders
            await this.fetchDefaultAccount();
            
            return true;
        } catch (error: any) {
            log(`[tradovate] Authentication Failed: ${error.response?.data || error.message}`, "error");
            return false;
        }
    }

    /**
     * Get the Authorization headers for requests. Auto-renews if expired.
     */
    private async getHeaders() {
        if (!this.token || Date.now() > this.tokenExpiration) {
            log("[tradovate] Token expired or missing. Re-authenticating...");
            await this.authenticate();
        }

        return {
            'Authorization': `Bearer ${this.token}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        };
    }

    /**
     * Fetch the user's primary Trading Account ID. Required for submitting orders.
     */
    private async fetchDefaultAccount() {
        try {
            const headers = await this.getHeaders();
            const response = await axios.get(`${this.baseUrl}/account/list`, { headers });
            
            if (response.data && response.data.length > 0) {
                // Usually take the first active account. Expand logic if user has multiple.
                this.accountId = response.data[0].id;
                log(`[tradovate] Bound to Account ID: ${this.accountId}`);
            } else {
                log(`[tradovate] No accounts found under this user!`, "warn");
            }
        } catch (error: any) {
            log(`[tradovate] Failed to fetch account: ${error.message}`, "error");
        }
    }

    /**
     * Get real-time Account Balance and Margin metrics
     */
    public async getAccountRisk() {
        if (!this.accountId) await this.fetchDefaultAccount();
        if (!this.accountId) return null;

        try {
            const headers = await this.getHeaders();
            const response = await axios.get(`${this.baseUrl}/margin/accountitem`, { 
                headers,
                params: { accountId: this.accountId }
            });
            
            return response.data;
        } catch (error: any) {
            log(`[tradovate] Failed to fetch risk metrics: ${error.message}`, "error");
            return null;
        }
    }

    /**
     * Submit a Market Order.
     * @param symbol - Contract name (e.g., "MNQM4")
     * @param action - "Buy" or "Sell"
     * @param quantity - Number of contracts (e.g., 1)
     */
    public async placeMarketOrder(symbol: string, action: "Buy" | "Sell", quantity: number) {
        if (!this.accountId) await this.fetchDefaultAccount();
        if (!this.accountId) throw new Error("No Account ID found for order execution.");

        log(`[tradovate] Submitting Live Market Order: ${action} ${quantity}x ${symbol}...`);

        try {
            const headers = await this.getHeaders();
            
            // 1. We must find the Tradovate Contract ID for the string symbol (e.g., 'MNQM4')
            const contractRes = await axios.get(`${this.baseUrl}/contract/find`, {
                headers,
                params: { name: symbol }
            });
            
            if (!contractRes.data || !contractRes.data.id) {
                throw new Error(`Invalid Symbol: ${symbol}. Could not locate Contract ID.`);
            }
            
            const contractId = contractRes.data.id;

            // 2. Submit the Order
            const orderPayload = {
                accountSpec: this.accountId.toString(),
                accountId: this.accountId,
                action: action,
                symbol: symbol,
                orderQty: quantity,
                orderType: "Market",
                isAutomated: true
            };

            const response = await axios.post(`${this.baseUrl}/order/placeorder`, orderPayload, { headers });
            log(`[tradovate] Order Successfully Placed! OrderID: ${response.data.orderId}`, "info");
            
            return response.data;
        } catch (error: any) {
            log(`[tradovate] Failed to place order: ${error.response?.data || error.message}`, "error");
            throw error;
        }
    }
}


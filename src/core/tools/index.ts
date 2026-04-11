import { SupabaseCrm, SupabaseDeal } from "../supabaseCrm.js";
import { CrmManager } from "../crm.js";
import { sendSms as twilioSendSms, skipTrace as apiSkipTrace, sendTelegram as apiSendTelegram, sendSurplusAlert as botSendSurplusAlert, generateContract as apiGenerateContract } from "../../services/outreachService.js";
import { findAuctionDeals as scrapeAuctionDeals } from "../../services/universalLeadScraper.js";

// Export individual functions if needed directly
export function findDeals(city: string) { return SupabaseCrm.findDeals(city); }
export function saveDeal(deal: SupabaseDeal) { return SupabaseCrm.insertDeal(deal); }
export function sendSMSArgs({ phone, message }: { phone: string, message: string }) { return twilioSendSms(phone, message); }
export function findAuctionDeals(city: string) { return scrapeAuctionDeals(city); }
export function calculateSurplus(salePrice: number, debt: number) { return salePrice - debt; }
export function skipTrace(name: string, city: string) { return apiSkipTrace(name, city); }
export function sendTelegram(message: string) { return apiSendTelegram(message); }
export function sendSurplusAlert(deal: { address: string, surplus: number, debt: number, owner: string, phone: string }) { return botSendSurplusAlert(deal); }

import { runSurplusAgent as executeSurplusAgent } from "../surplus/runSurplusAgent.js";
import { triggerAICall as apiTriggerAICall } from "../../services/outreachService.js";

export const tools = {
  findDeals: async ({ city }: { city: string }) => {
    return await findDeals(city);
  },

  calculateMaxOffer: async ({ arv, repairs }: { arv: number, repairs: number }) => {
    return (arv * 0.7) - repairs;
  },

  saveDeal: async (deal: SupabaseDeal) => {
    return await saveDeal(deal);
  },

  sendSMS: async ({ phone, message }: { phone: string, message: string }) => {
    return await sendSMSArgs({ phone, message });
  },

  findAuctionDeals: async ({ city }: { city: string }) => {
    return await findAuctionDeals(city);
  },

  calculateSurplus: async ({ salePrice, debt }: { salePrice: number, debt: number }) => {
    return calculateSurplus(salePrice, debt);
  },

  skipTrace: async ({ name, city }: { name: string, city: string }) => {
    return await skipTrace(name, city);
  },

  sendTelegram: async ({ message }: { message: string }) => {
    return await sendTelegram(message);
  },

  sendSurplusAlert: async (deal: { address: string, surplus: number, debt: number, owner: string, phone: string }) => {
    return await sendSurplusAlert(deal);
  },

  runSurplusAgent: async ({ city }: { city: string }) => {
    return await executeSurplusAgent(city);
  },

  triggerAICall: async ({ deal }: { deal: any }) => {
    return await apiTriggerAICall(deal);
  },
  
  generateContract: async ({ deal }: { deal: any }) => {
    return apiGenerateContract(deal);
  },

  alertBuyers: async ({ dealId }: { dealId: number }) => {
    return await CrmManager.alertMatchedBuyers(dealId);
  }
};

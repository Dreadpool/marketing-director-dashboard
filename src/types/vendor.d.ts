declare module "facebook-nodejs-business-sdk" {
  export class FacebookAdsApi {
    static init(accessToken: string): FacebookAdsApi;
  }

  export class AdAccount {
    constructor(id: string);
    read(fields: string[]): Promise<Record<string, unknown>>;
    getInsights(
      fields: string[],
      params: Record<string, unknown>,
    ): Promise<AdAccountInsightsCursor>;
  }

  interface AdAccountInsightsCursor extends Array<Record<string, unknown>> {
    hasNext(): boolean;
    next(): Promise<AdAccountInsightsCursor>;
  }

  const _default: {
    FacebookAdsApi: typeof FacebookAdsApi;
    AdAccount: typeof AdAccount;
  };
  export default _default;
}

declare module "google-ads-api" {
  export class GoogleAdsApi {
    constructor(options: {
      client_id: string;
      client_secret: string;
      developer_token: string;
    });
    Customer(
      options: {
        customer_id: string;
        login_customer_id: string;
        refresh_token: string;
      },
      overrides?: Record<string, unknown>,
    ): GoogleAdsCustomer;
  }

  interface GoogleAdsCustomer {
    query(query: string): Promise<Record<string, unknown>[]>;
  }
}

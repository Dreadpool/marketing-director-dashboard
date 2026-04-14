/**
 * Test script: fetch ad creative thumbnails from Meta API
 * Run: npx tsx temp_files/test-creative-thumbnails.ts
 */

import { FacebookAdsApi, AdAccount } from "facebook-nodejs-business-sdk";

const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN ?? "";
const AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID ?? "act_1599255740369627";

async function main() {
  FacebookAdsApi.init(ACCESS_TOKEN);
  const account = new AdAccount(AD_ACCOUNT_ID);

  console.log("Fetching ads with creative data...\n");

  // Approach 1: Fetch ads directly (not insights) with creative subfields
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cursor = await (account as any).getAds(
    [
      "id",
      "name",
      "status",
      "creative{id,thumbnail_url,image_url,object_story_spec,effective_object_story_id}",
    ],
    {
      effective_status: ["ACTIVE", "PAUSED"],
      limit: 10,
    },
  );

  const ads: any[] = [];
  // Collect up to 10
  cursor.forEach((ad: any) => {
    if (ads.length < 10) ads.push(ad);
  });

  // Wait for pagination
  while (cursor.hasNext() && ads.length < 10) {
    const nextPage = await cursor.next();
    nextPage.forEach((ad: any) => {
      if (ads.length < 10) ads.push(ad);
    });
  }

  console.log(`Found ${ads.length} ads\n`);

  for (const ad of ads) {
    const data = ad._data ?? ad;
    const creative = data.creative?._data ?? data.creative ?? {};

    console.log("─".repeat(60));
    console.log(`Ad: ${data.name}`);
    console.log(`  ID: ${data.id}`);
    console.log(`  Status: ${data.status}`);
    console.log(`  Creative ID: ${creative.id ?? "N/A"}`);
    console.log(`  thumbnail_url: ${creative.thumbnail_url ?? "NONE"}`);
    console.log(`  image_url: ${creative.image_url ?? "NONE"}`);

    // Check object_story_spec for image/video data
    const oss = creative.object_story_spec;
    if (oss) {
      if (oss.video_data) {
        console.log(`  Video image URL: ${oss.video_data.image_url ?? "NONE"}`);
        console.log(`  Video title: ${oss.video_data.title ?? "NONE"}`);
      }
      if (oss.link_data) {
        console.log(`  Link image: ${oss.link_data.image_hash ?? oss.link_data.picture ?? "NONE"}`);
      }
    }
    console.log();
  }

  // Also try fetching ad images from the account
  console.log("\n" + "=".repeat(60));
  console.log("Testing ad image fetch via account images endpoint...\n");

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const images = await (account as any).getAdImages(["id", "name", "url", "url_128", "permalink_url"], { limit: 5 });
    const imageList: any[] = [];
    images.forEach((img: any) => {
      if (imageList.length < 5) imageList.push(img);
    });

    for (const img of imageList) {
      const d = img._data ?? img;
      console.log(`Image: ${d.name ?? d.id}`);
      console.log(`  url_128: ${d.url_128 ?? "NONE"}`);
      console.log(`  url: ${d.url ?? "NONE"}`);
      console.log(`  permalink: ${d.permalink_url ?? "NONE"}`);
      console.log();
    }
  } catch (e) {
    console.log(`Ad images endpoint failed: ${e instanceof Error ? e.message : e}`);
  }
}

main().catch((err) => {
  console.error("Failed:", err.message ?? err);
  process.exit(1);
});

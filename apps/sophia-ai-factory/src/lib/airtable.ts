import Airtable, { FieldSet, Record as AirtableRecord } from "airtable";
import {
  ScriptRecord,
  ScriptStatus,
  VideoRecord,
  AffiliateProgram,
  Tier,
} from "@/types";

// Initialize Airtable
// Note: In Next.js, use process.env for server-side secrets
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
  console.warn(
    "Airtable API Key or Base ID is missing. Airtable integration will not work."
  );
}

const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(
  AIRTABLE_BASE_ID || ""
);

// Table Names
const TABLES = {
  SCRIPTS: "Scripts",
  VIDEOS: "Videos",
  AFFILIATES: "Affiliates",
};

/**
 * Airtable Client Wrapper
 */
export const airtable = {
  /**
   * Scripts Operations
   */
  scripts: {
    async create(data: Omit<ScriptRecord, "id" | "createdAt" | "updatedAt">) {
      const records = await base(TABLES.SCRIPTS).create([
        {
          fields: {
            Topic: data.topic,
            Content: data.content,
            Status: data.status,
            Tier: data.tier,
            UserId: data.userId,
            CreatedAt: new Date().toISOString(),
          },
        },
      ]);
      return mapScriptRecord(records[0]);
    },

    async get(id: string) {
      const record = await base(TABLES.SCRIPTS).find(id);
      return mapScriptRecord(record);
    },

    async updateStatus(id: string, status: ScriptStatus) {
      const records = await base(TABLES.SCRIPTS).update([
        {
          id,
          fields: {
            Status: status,
            UpdatedAt: new Date().toISOString(),
          },
        },
      ]);
      return mapScriptRecord(records[0]);
    },

    async updateMedia(id: string, type: "audio" | "video", url: string) {
      const field = type === "audio" ? "AudioUrl" : "VideoUrl";
      const records = await base(TABLES.SCRIPTS).update([
        {
          id,
          fields: {
            [field]: url,
            UpdatedAt: new Date().toISOString(),
          },
        },
      ]);
      return mapScriptRecord(records[0]);
    },

    async list(userId?: string) {
      const options: {
        sort: { field: string; direction: "asc" | "desc" }[];
        filterByFormula?: string;
      } = {
        sort: [{ field: "CreatedAt", direction: "desc" }],
      };

      if (userId) {
        options.filterByFormula = `{UserId} = '${userId}'`;
      }

      const records = await base(TABLES.SCRIPTS).select(options).all();
      return records.map(mapScriptRecord);
    },
  },

  /**
   * Videos Operations
   */
  videos: {
    async create(data: Omit<VideoRecord, "id" | "createdAt">) {
      const records = await base(TABLES.VIDEOS).create([
        {
          fields: {
            ScriptId: [data.scriptId], // Link to Script record
            VideoUrl: data.videoUrl,
            Platform: data.platform,
            Status: data.status,
            CreatedAt: new Date().toISOString(),
          },
        },
      ]);
      return mapVideoRecord(records[0]);
    },

    async updateStatus(
      id: string,
      status: VideoRecord["status"],
      stats?: VideoRecord["stats"]
    ) {
      const fields: FieldSet = { Status: status };
      if (stats) {
        fields.StatsViews = stats.views;
        fields.StatsLikes = stats.likes;
        fields.StatsShares = stats.shares;
      }

      const records = await base(TABLES.VIDEOS).update([
        {
          id,
          fields,
        },
      ]);
      return mapVideoRecord(records[0]);
    },
  },

  /**
   * Affiliates Operations
   */
  affiliates: {
    async list(tier: Tier = "BASIC") {
      // Basic tier sees only Basic programs
      // Premium sees Basic + Premium
      // Enterprise sees all
      let filterFormula = "";

      if (tier === "BASIC") {
        filterFormula = "{Tier} = 'BASIC'";
      } else if (tier === "PREMIUM") {
        filterFormula = "OR({Tier} = 'BASIC', {Tier} = 'PREMIUM')";
      }
      // Enterprise: no filter (shows all)

      const records = await base(TABLES.AFFILIATES)
        .select({
          filterByFormula: filterFormula,
          sort: [{ field: "Name", direction: "asc" }],
        })
        .all();

      return records.map(mapAffiliateRecord);
    },
  },
};

// --- Mappers ---

function mapScriptRecord(record: AirtableRecord<FieldSet>): ScriptRecord {
  return {
    id: record.id,
    topic: record.get("Topic") as string,
    content: record.get("Content") as string,
    status: record.get("Status") as ScriptStatus,
    tier: record.get("Tier") as Tier,
    userId: record.get("UserId") as string,
    createdAt: record.get("CreatedAt") as string,
    audioUrl: record.get("AudioUrl") as string | undefined,
    videoUrl: record.get("VideoUrl") as string | undefined,
    updatedAt: record.get("UpdatedAt") as string | undefined,
  };
}

function mapVideoRecord(record: AirtableRecord<FieldSet>): VideoRecord {
  const scriptIds = record.get("ScriptId") as string[];
  return {
    id: record.id,
    scriptId: scriptIds && scriptIds.length > 0 ? scriptIds[0] : "",
    videoUrl: record.get("VideoUrl") as string,
    thumbnailUrl: record.get("ThumbnailUrl") as string | undefined,
    platform: record.get("Platform") as "youtube" | "tiktok" | "instagram",
    status: record.get("Status") as "processing" | "completed" | "failed",
    stats: {
      views: (record.get("StatsViews") as number) || 0,
      likes: (record.get("StatsLikes") as number) || 0,
      shares: (record.get("StatsShares") as number) || 0,
    },
    createdAt: record.get("CreatedAt") as string,
  };
}

function mapAffiliateRecord(record: AirtableRecord<FieldSet>): AffiliateProgram {
  return {
    id: record.id,
    name: record.get("Name") as string,
    category: record.get("Category") as string,
    commission: record.get("Commission") as string,
    commissionType: record.get("CommissionType") as
      | "recurring"
      | "one-time"
      | "hybrid",
    cookieDuration: (record.get("CookieDuration") as number) || 30,
    payoutTerms: record.get("PayoutTerms") as string,
    epc: (record.get("EPC") as number) || 0,
    link: record.get("Link") as string,
    description: record.get("Description") as string | undefined,
    tags: (record.get("Tags") as string[]) || [],
    tier: (record.get("Tier") as Tier) || "BASIC",
  };
}

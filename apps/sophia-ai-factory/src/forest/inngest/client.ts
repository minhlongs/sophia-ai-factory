/**
 * Forest Inngest client — layer seam over the canonical seed client.
 *
 * Forest functions and the serve route resolve their Inngest client through
 * this module to keep the documented layer boundary. The implementation and
 * merged event schema live in seed/inngest; the former duplicate tree client
 * was consolidated into it.
 *
 * Layer: forest.
 */

export { inngest } from "@/seed/inngest/client";

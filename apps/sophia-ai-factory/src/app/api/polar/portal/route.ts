import { CustomerPortal } from "@polar-sh/nextjs";
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const GET = CustomerPortal({
  accessToken: process.env.POLAR_ACCESS_TOKEN!,
  getCustomerId: async (req: NextRequest) => {
    // Get current user from Supabase
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return '';
    }
    
    // Get Polar customer ID from profile
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('polar_customer_id')
      .eq('user_id', user.id)
      .single();
    
    return profile?.polar_customer_id || '';
  },
  returnUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  server: process.env.NODE_ENV === 'development' ? 'sandbox' : 'production',
});

import { Suspense } from "react";
import { Pricing } from "@/features/monetization/components/Pricing";

export default function PricingPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="w-8 h-8 rounded-full border-2 border-[#7B5CF6] border-t-transparent animate-spin" /></div>}>
            <Pricing />
        </Suspense>
    );
}

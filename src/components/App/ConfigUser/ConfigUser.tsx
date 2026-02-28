import { Toaster } from "sonner";
import { useUserProfile } from "./hooks/useUserProfile";
import { ProfileSection } from "./ProfileSection";
import { PremiumSection } from "./PremiumSection";

export default function ConfigUser() {
  const { profile, loading, updateProfile, requestPremium } = useUserProfile();

  return (
    <div className="flex flex-col gap-4">
      <Toaster />

      <ProfileSection
        profile={profile}
        loading={loading}
        onSave={updateProfile}
      />

      <PremiumSection
        profile={profile}
        loading={loading}
        onRequest={requestPremium}
      />
    </div>
  );
}

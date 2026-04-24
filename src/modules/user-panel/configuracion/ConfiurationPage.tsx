import { Toaster } from "sonner";
import { useUserProfile } from "../hooks/useUserProfile";
import { ProfileSection } from "./components/ProfileSection";
import { PremiumSection } from "./components/PremiumSection";
import { useUpdateUser } from "../hooks/useUpdateUser";


export default function ConfigurationPage() {

    const { profile, loading } = useUserProfile()
    const { updateUser } = useUpdateUser()

    const requestPremium = ()=>{
        // TODO falta esto
    }

    return (
        <div className="flex flex-col gap-4">
            <Toaster />

            <ProfileSection
                profile={profile}
                loading={loading}
                onSave={updateUser}
            />

            <PremiumSection
                profile={profile}
                loading={loading}
                onRequest={requestPremium}
            />
        </div>
    );
}
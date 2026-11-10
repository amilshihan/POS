import { getCurrentUserAndProfile } from "@/lib/auth";
import ProfileClient from "@/components/profile/ProfileClient";

export default async function ProfilePage() {
  const { profile } = await getCurrentUserAndProfile();

  return (
    <ProfileClient
      profile={
        profile
          ? {
              full_name: profile.full_name,
              phone: profile.phone,
              nic_no: profile.nic_no,
              username: profile.username,
              must_change_password: profile.must_change_password,
            }
          : null
      }
    />
  );
}

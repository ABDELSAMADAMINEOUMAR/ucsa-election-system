import { AccountForm } from "@/components/account/form";
export const metadata = { title: "Reset password · UCSA Elections" };
export default async function Page({
  searchParams,
}: PageProps<"/account/reset-password">) {
  const { notice } = await searchParams;
  return (
    <AccountForm mode="reset" invalidRecoveryLink={notice === "link-invalid"} />
  );
}

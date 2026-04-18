import { useParams } from "react-router-dom";

import PlaceholderPage from "../_PlaceholderPage.jsx";

export default function FollowersPage() {
  const { username } = useParams();
  return (
    <PlaceholderPage
      title={`@${username} · Takipçiler`}
      description="Bu kullanıcıyı takip edenlerin listesi burada gösterilecek."
      step="STEP 30"
    />
  );
}

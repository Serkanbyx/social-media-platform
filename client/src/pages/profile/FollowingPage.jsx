import { useParams } from "react-router-dom";

import PlaceholderPage from "../_PlaceholderPage.jsx";

export default function FollowingPage() {
  const { username } = useParams();
  return (
    <PlaceholderPage
      title={`@${username} · Takip edilen`}
      description="Bu kullanıcının takip ettiği hesapların listesi burada gösterilecek."
      step="STEP 30"
    />
  );
}

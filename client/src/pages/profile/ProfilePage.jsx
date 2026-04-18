import { useParams } from "react-router-dom";

import PlaceholderPage from "../_PlaceholderPage.jsx";

export default function ProfilePage() {
  const { username } = useParams();
  return (
    <PlaceholderPage
      title={`@${username}`}
      description="Profil başlığı, biyografi, takip butonu ve gönderi galerisi burada yer alacak."
      step="STEP 30"
    />
  );
}

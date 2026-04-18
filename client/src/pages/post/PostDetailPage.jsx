import { useParams } from "react-router-dom";

import PlaceholderPage from "../_PlaceholderPage.jsx";

export default function PostDetailPage() {
  const { id } = useParams();
  return (
    <PlaceholderPage
      title="Gönderi"
      description={`#${id} ID'li gönderinin detayı, yorumları ve etkileşimleri burada gösterilecek.`}
      step="STEP 28"
    />
  );
}

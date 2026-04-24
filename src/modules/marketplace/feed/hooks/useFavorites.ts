import { useEffect, useState } from "react";
import { getFavoriteIds } from "../services/property.service";
import type { Session } from "@supabase/supabase-js";

type Props = {
  session: Session | null
}

export function useFavorites({ session }: Props) {
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    if (!session) {
      setFavorites([]);
      return;
    }

    getFavoriteIds(session.user.id)
      .then(setFavorites)
      .catch((err) => console.error("[useFavorites]", err));
  }, [session]);

  return { favorites };
}
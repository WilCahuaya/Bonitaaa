export type Photo = {
  id: string;
  src: string;
};

export const PHOTOS: Photo[] = Array.from({ length: 24 }, (_, index) => {
  const id = String(index + 1).padStart(2, "0");
  return { id, src: `/photos/${id}.jpg` };
});

export const COVER_IDS = ["02", "04", "10", "14", "17", "23"];
export const PAIR_IDS = ["01", "17"];

export function photoById(id: string) {
  return PHOTOS.find((photo) => photo.id === id);
}

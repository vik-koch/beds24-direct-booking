export interface Apartment {
  id: number;
  propertyId: number;
  name: string;
}

interface Properties {
  data: { id: number; roomTypes: { id: number; name: string }[] }[];
}

export const listApartments = async (): Promise<Apartment[]> => {
  const response = await fetch(`${process.env['BEDS24_URL']}/properties?includeAllRooms=true`, {
    headers: { token: process.env['BEDS24_TOKEN'] ?? '' },
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`Beds24 answered ${response.status}`);
  const { data }: Properties = await response.json();
  return data.flatMap((property) =>
    property.roomTypes.map(({ id, name }) => ({ id, propertyId: property.id, name })),
  );
};

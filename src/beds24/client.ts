export interface Apartment {
  id: number;
  propertyId: number;
  name: string;
}

interface Properties {
  data: { id: number; roomTypes: { id: number; name: string }[] }[];
}

export const listApartments = async (): Promise<Apartment[]> => {
  const url = process.env['BEDS24_URL'];
  if (!url) throw new Error('BEDS24_URL is not set: the address of Beds24 or the simulator');
  const response = await fetch(`${url}/properties?includeAllRooms=true`, {
    headers: { token: process.env['BEDS24_TOKEN'] ?? '' },
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`Beds24 answered ${response.status}`);
  const { data }: Properties = await response.json();
  return data.flatMap((property) =>
    property.roomTypes.map(({ id, name }) => ({ id, propertyId: property.id, name })),
  );
};

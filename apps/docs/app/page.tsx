import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/card";

export default function Home() {
  return (
    <main className="p-8">
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Finance App Documentation</CardTitle>
        </CardHeader>
        <CardContent>Internal product and API documentation.</CardContent>
      </Card>
    </main>
  );
}

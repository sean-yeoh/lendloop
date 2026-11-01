import type { Metadata } from "next";
import { Suspense } from "react";
import { ToolsBrowser } from "@/components/tools/ToolsBrowser";
import { isToolCategory } from "@/lib/tools";

export const metadata: Metadata = { title: "Tools · LendLoop" };

export default function ToolsPage({ searchParams }: PageProps<"/tools">) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">All tools</h1>
      {/* searchParams is request data, so it must render inside Suspense with Cache Components. */}
      <Suspense>
        <FilteredTools searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function FilteredTools({ searchParams }: Pick<PageProps<"/tools">, "searchParams">) {
  const { category } = await searchParams;
  return <ToolsBrowser category={isToolCategory(category) ? category : undefined} />;
}

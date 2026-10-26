import { redirect } from 'next/navigation';

/**
 * Старый URL /forum/1 был двусмысленным (категория vs тема).
 * Всегда ведём в категорию /forum/c/[id].
 * Темы — только /forum/thread/[id].
 */
export default async function ForumLegacyIdPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/forum/c/${id}`);
}

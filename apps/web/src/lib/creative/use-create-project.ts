import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import type { CreativeDocument } from '@quickbiz/shared';
import { getProjectStore, type CreativeProjectRecord } from './storage';

export interface CreateProjectInput {
  readonly title: string;
  readonly document: CreativeDocument;
}

/**
 * Create a project from a document and open it.
 *
 * Shared by the projects page, the template gallery and the blank-canvas dialog so
 * every entry point persists in exactly the same way.
 */
export function useCreateProject() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ title, document }: CreateProjectInput) => {
      const record: CreativeProjectRecord = {
        id: document.id,
        title,
        document: { ...document, title },
        createdAt: document.createdAt,
        updatedAt: new Date().toISOString(),
      };
      await getProjectStore().put(record);
      return record;
    },
    onSuccess: async (record) => {
      await queryClient.invalidateQueries({ queryKey: ['creative-projects'] });
      navigate(`/studio/${record.id}`);
    },
  });
}

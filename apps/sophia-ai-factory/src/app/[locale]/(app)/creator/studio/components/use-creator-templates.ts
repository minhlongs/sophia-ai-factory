'use client';

import { useState, useCallback } from 'react';
import {
  CREATOR_MARKETPLACE_V2_ENABLED,
  MARKETPLACE_TEMPORARILY_UNAVAILABLE_MESSAGE,
} from '@/land/sop-marketplace/availability';
import type { TemplateFormData } from './types';
import { INITIAL_TEMPLATE_FORM } from './constants';
import { postCreatorTemplate } from './creator-studio-api';
import { getMaintenanceErrorMessage } from './creator-studio-fetcher';

interface UseCreatorTemplatesInput {
  isVi: boolean;
  setErrorMsg: React.Dispatch<React.SetStateAction<string | null>>;
  fetchData: () => Promise<void>;
}

interface UseCreatorTemplatesOutput {
  isTemplateModalOpen: boolean;
  setIsTemplateModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  submittingTemplate: boolean;
  templateForm: TemplateFormData;
  setTemplateForm: React.Dispatch<React.SetStateAction<TemplateFormData>>;
  handleCreateTemplate: (e: React.FormEvent) => Promise<void>;
}

export function useCreatorTemplates({
  isVi,
  setErrorMsg,
  fetchData,
}: UseCreatorTemplatesInput): UseCreatorTemplatesOutput {
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState<boolean>(false);
  const [submittingTemplate, setSubmittingTemplate] = useState<boolean>(false);
  const [templateForm, setTemplateForm] = useState<TemplateFormData>(INITIAL_TEMPLATE_FORM);

  const handleCreateTemplate = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!CREATOR_MARKETPLACE_V2_ENABLED) {
      setErrorMsg(
        getMaintenanceErrorMessage(isVi, MARKETPLACE_TEMPORARILY_UNAVAILABLE_MESSAGE)
      );
      return;
    }
    setSubmittingTemplate(true);
    setErrorMsg(null);
    try {
      await postCreatorTemplate(templateForm);
      setIsTemplateModalOpen(false);
      setTemplateForm(INITIAL_TEMPLATE_FORM);
      await fetchData();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setSubmittingTemplate(false);
    }
  }, [isVi, templateForm, setErrorMsg, fetchData]);

  return {
    isTemplateModalOpen,
    setIsTemplateModalOpen,
    submittingTemplate,
    templateForm,
    setTemplateForm,
    handleCreateTemplate,
  };
}
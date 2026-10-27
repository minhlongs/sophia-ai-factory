import React from 'react';
import { buildIllustrativeWorkflowView } from '@/tree/mission/workflow-view-model';
import { CreativeAssemblyLine } from '@/components/workflow-anatomy/creative-assembly-line';
import { PipelineMockupHeader } from './pipeline-mockup-header';
import { PipelineMockupFooter } from './pipeline-mockup-footer';

const ILLUSTRATIVE_WORKFLOW = buildIllustrativeWorkflowView();

export function PipelineMockup() {
  return (
    <div className="studio-glass film-strip w-full max-w-5xl rounded-2xl border border-[#E2E8F0] dark:border-white/[0.08] bg-white dark:bg-[#11131F] p-4 sm:p-7 shadow-xl dark:shadow-2xl text-left relative group">
      <PipelineMockupHeader />
      <div className="mb-6">
        <CreativeAssemblyLine workflow={ILLUSTRATIVE_WORKFLOW} />
      </div>
      <PipelineMockupFooter />
    </div>
  );
}

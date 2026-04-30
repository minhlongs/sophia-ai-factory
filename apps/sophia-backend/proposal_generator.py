"""
Proposal Generator
Uses GPT-4 with RAG context to generate proposals in brand voice
"""

from typing import Dict, Any, List, Optional
from datetime import datetime

from .ai_client import ai_client
from .brand_voice import brand_voice_manager


class ProposalGenerator:
    """Generate proposals using GPT-4 with brand voice RAG."""

    # Proposal sections and their prompts
    SECTIONS = [
        "executive_summary",
        "problem_statement",
        "proposed_solution",
        "approach",
        "timeline",
        "investment",
        "about_us",
        "next_steps"
    ]

    def generate_full_proposal(
        self,
        org_id: str,
        title: str,
        client_name: str,
        project_brief: str,
        requirements: List[str],
        budget_range: Optional[str] = None,
        timeline_preference: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generate a complete proposal with all sections.

        Args:
            org_id: Organization UUID
            title: Proposal title
            client_name: Client name
            project_brief: Project description/brief
            requirements: List of project requirements
            budget_range: Optional budget range
            timeline_preference: Optional timeline preference

        Returns:
            Complete proposal content as JSON
        """
        # Build RAG context from brand voice
        rag_context = brand_voice_manager.build_brand_voice_context(
            org_id,
            f"proposal for {client_name}: {project_brief[:100]}"
        )

        # Build project context
        project_context = self._build_project_context(
            title=title,
            client_name=client_name,
            brief=project_brief,
            requirements=requirements,
            budget=budget_range,
            timeline=timeline_preference
        )

        # Generate each section
        sections = {}
        for section in self.SECTIONS:
            section_content = self._generate_section(
                section_type=section,
                project_context=project_context,
                rag_context=rag_context,
                client_info={"name": client_name}
            )
            sections[section] = section_content

        # Build final proposal
        proposal = {
            "title": title,
            "client_name": client_name,
            "generated_at": datetime.utcnow().isoformat(),
            "sections": sections,
            "metadata": {
                "budget_range": budget_range,
                "timeline_preference": timeline_preference,
                "requirements_count": len(requirements)
            }
        }

        return proposal

    def _build_project_context(
        self,
        title: str,
        client_name: str,
        brief: str,
        requirements: List[str],
        budget: Optional[str] = None,
        timeline: Optional[str] = None
    ) -> str:
        """Build comprehensive project context string."""
        context = f"""Project Title: {title}
Client: {client_name}

Project Brief:
{brief}

Requirements:
"""
        for i, req in enumerate(requirements, 1):
            context += f"{i}. {req}\n"

        if budget:
            context += f"\nBudget Range: {budget}"

        if timeline:
            context += f"\nTimeline Preference: {timeline}"

        return context

    def _generate_section(
        self,
        section_type: str,
        project_context: str,
        rag_context: str,
        client_info: Dict[str, Any]
    ) -> str:
        """
        Generate a single proposal section.

        Args:
            section_type: Type of section to generate
            project_context: Full project context
            rag_context: RAG context from brand voice
            client_info: Client information

        Returns:
            Generated section content
        """
        # Build the prompt with all context
        prompt = f"""{project_context}

Brand Voice Context:
{rag_context}

Generate the {section_type.replace('_', ' ').title()} section.
Make it specific to the client's needs and compelling."""

        return ai_client.generate_proposal_section(
            section_type=section_type,
            context=prompt,
            brand_voice=None,  # Already included in context
            client_info=client_info
        )

    def generate_proposal_outline(
        self,
        project_brief: str,
        requirements: List[str]
    ) -> List[Dict[str, str]]:
        """
        Generate a proposal outline with section descriptions.

        Args:
            project_brief: Project description
            requirements: List of requirements

        Returns:
            List of sections with descriptions
        """
        context = f"Project: {project_brief}\nRequirements: {', '.join(requirements)}"

        prompt = f"""{context}

Generate a proposal outline. For each section, provide:
1. Section name
2. Brief description of what this section will cover
3. Estimated word count

Return as a structured list."""

        response = ai_client.generate_text(
            prompt=prompt,
            system_message="You are an expert proposal writer. Create clear, actionable outlines."
        )

        # Parse response into structured outline
        outline = []
        for line in response.strip().split('\n'):
            if line.strip():
                outline.append({
                    "section": line.split(':')[0] if ':' in line else line,
                    "description": line.split(':')[1] if ':' in line else line
                })

        return outline

    def refine_section(
        self,
        org_id: str,
        section_type: str,
        existing_content: str,
        feedback: str
    ) -> str:
        """
        Refine an existing section based on feedback.

        Args:
            org_id: Organization UUID
            section_type: Type of section
            existing_content: Current section content
            feedback: User feedback for refinement

        Returns:
            Refined section content
        """
        rag_context = brand_voice_manager.build_brand_voice_context(
            org_id,
            f"refine {section_type}: {feedback}"
        )

        prompt = f"""Current {section_type} content:
{existing_content}

Feedback to address:
{feedback}

Brand Voice Context:
{rag_context}

Rewrite this section addressing the feedback while maintaining brand voice."""

        return ai_client.generate_text(
            prompt=prompt,
            system_message="You are an expert editor. Refine content based on feedback while maintaining quality."
        )


# Global generator instance
proposal_generator = ProposalGenerator()

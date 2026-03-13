"""CLI Commands Implementation"""

from rich.console import Console
from rich.table import Table
from rich.panel import Panel

from ..sops.storage import SOPStorage
from ..sops.parser import SOPParser
from ..core.engine import PEVEngine, Planner
from ..llm.client import LLMRouter

console = Console()
storage = SOPStorage(sops_path="sops/procedures")
parser = SOPParser()
llm_router = LLMRouter()
pev_engine = PEVEngine()


def cook(goal: str, verbose: bool = False, dry_run: bool = False):
    """Execute SOP to achieve goal"""
    console.print(Panel(f"[bold]Goal:[/bold] {goal}"))

    if dry_run:
        console.print("[yellow]Dry run mode - generating plan only[/yellow]")

    # Generate plan using LLM
    planner = Planner(llm_router)
    console.print("\n[bold]Generating plan...[/bold]")

    try:
        plan_text = planner.generate_plan(goal)
        console.print(f"\n{plan_text}")

        if dry_run:
            console.print("\n[yellow]Dry run complete. Remove --dry-run to execute.[/yellow]")
            return

        # TODO: Auto-execute generated plan
        console.print("\n[yellow]Plan execution coming soon...[/yellow]")

    except Exception as e:
        console.print(f"[red]Error generating plan: {e}[/red]")


def run_sop(name: str, version: str = None):
    """Run specific SOP"""
    try:
        sop = storage.load(name, version)
        console.print(Panel(f"[bold]Running SOP:[/bold] {sop.name} v{sop.version}"))
        console.print(f"[cyan]Description:[/cyan] {sop.description}")

        # Execute with PEV engine
        result = pev_engine.execute_sop(sop)

        console.print(f"\n[bold]Execution Result:[/bold]")
        if result.success:
            console.print(f"[green]✓ SUCCESS[/green] - {result.steps_completed} steps completed")
            console.print(f"  Duration: {result.duration_ms}ms")
        else:
            console.print(f"[red]✗ FAILED[/red] - {result.steps_failed} steps failed")
            console.print(f"  Completed: {result.steps_completed}, Failed: {result.steps_failed}")

    except Exception as e:
        console.print(f"[red]Error: {e}[/red]")


def sop_new(name: str):
    """Create new SOP template"""
    template = """name: {name}
version: 1.0.0
description: "Description of this SOP"

steps:
  - id: step1
    command: "echo 'Step 1 command'"
    timeout: 60
    validation: "exit_code == 0"
    description: "First step"

  - id: step2
    command: "echo 'Step 2 command'"
    timeout: 60
    validation: "exit_code == 0"
    description: "Second step"

quality_gates:
  - name: validation
    check: "echo 'Validation check'"
    description: "Quality validation"
""".format(
        name=name
    )

    sop_dir = storage.sops_path / name / "1.0.0"
    sop_dir.mkdir(parents=True, exist_ok=True)

    sop_file = sop_dir / "sop.yaml"
    sop_file.write_text(template)

    # Create latest symlink with relative path
    latest_link = storage.sops_path / name / "latest"
    if latest_link.exists() or latest_link.is_symlink():
        latest_link.unlink()
    latest_link.symlink_to("1.0.0")

    console.print(f"[green]✓ Created SOP:[/green] {sop_file}")
    console.print(f"Edit the file to customize your SOP")


def sop_list():
    """List all SOPs"""
    sops = storage.list_sops()

    if not sops:
        console.print("[yellow]No SOPs found. Create one with: agi-sops sop new <name>[/yellow]")
        return

    table = Table(title="Available SOPs")
    table.add_column("Name", style="cyan")
    table.add_column("Version", style="green")
    table.add_column("Description", style="white")
    table.add_column("Steps", justify="right")

    for sop in sops:
        table.add_row(sop["name"], sop["version"], sop["description"], str(sop["steps_count"]))

    console.print(table)


def sop_show(name: str, version: str = None):
    """Show SOP details"""
    try:
        sop = storage.load(name, version)

        console.print(Panel(f"[bold]{sop.name}[/bold] v{sop.version}"))
        console.print(f"[cyan]Description:[/cyan] {sop.description}\n")

        console.print("[bold]Steps:[/bold]")
        for i, step in enumerate(sop.steps, 1):
            console.print(f"\n  [green]{i}. {step.id}[/green]")
            console.print(f"     Command: [white]{step.command}[/white]")
            if step.timeout:
                console.print(f"     Timeout: {step.timeout}s")
            if step.validation:
                console.print(f"     Validation: {step.validation}")
            if step.rollback:
                console.print(f"     Rollback: {step.rollback}")
            if step.description:
                console.print(f"     Description: {step.description}")

        if sop.quality_gates:
            console.print(f"\n[bold]Quality Gates ({len(sop.quality_gates)}):[/bold]")
            for gate in sop.quality_gates:
                console.print(f"  • [yellow]{gate.name}[/yellow]: {gate.check}")

    except Exception as e:
        console.print(f"[red]Error: {e}[/red]")


def rag_search(query: str, limit: int = 5):
    """Search SOPs with semantic search"""
    from ..rag.retriever import RAGEngine

    console.print(Panel(f"[bold]Searching:[/bold] {query}"))

    try:
        rag = RAGEngine()
        results = rag.search(query, limit)

        if not results:
            console.print("[yellow]No results found[/yellow]")
            return

        console.print(f"\n[green]Found {len(results)} results:[/green]")
        for i, result in enumerate(results, 1):
            console.print(f"\n  {i}. [cyan]{result.get('name', 'Unknown')}[/cyan]")
            console.print(f"     Distance: {result.get('_distance', 0):.4f}")
            console.print(f"     Content: {result.get('content', '')[:200]}...")

    except ImportError as e:
        console.print(f"[yellow]RAG dependencies not installed: {e}[/yellow]")
    except Exception as e:
        console.print(f"[red]Error: {e}[/red]")

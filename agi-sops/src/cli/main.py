"""CLI Main Entry Point"""

import typer
from rich.console import Console
from rich.table import Table

from .commands import cook as cook_cmd, run_sop, sop_new, sop_list, sop_show, rag_search
from .. import __version__

app = typer.Typer(help="AGI SOPs - Local LLM powered Standard Operating Procedures")
console = Console()


@app.callback()
def main_callback(
    version: bool = typer.Option(
        False, "--version", "-v", help="Show version and exit"
    )
):
    """Show version"""
    if version:
        console.print(f"[bold blue]agi-sops[/bold blue] v{__version__}")
        raise typer.Exit()


@app.command()
def version():
    """Show version"""
    console.print(f"[bold blue]agi-sops[/bold blue] v{__version__}")


@app.command()
def cook(
    goal: str = typer.Argument(..., help="Goal to achieve"),
    verbose: bool = typer.Option(False, "--verbose", "-v", help="Show step details"),
    dry_run: bool = typer.Option(False, "--dry-run", help="Show plan only"),
):
    """Execute SOP to achieve goal"""
    cook_cmd(goal, verbose=verbose, dry_run=dry_run)


@app.command()
def plan(
    goal: str = typer.Argument(..., help="Goal to plan"),
):
    """Generate execution plan for goal"""
    cook_cmd(goal, dry_run=True)


@app.command()
def run(
    name: str = typer.Argument(..., help="SOP name to run"),
    version: str = typer.Option(None, "--version", help="SOP version"),
):
    """Run specific SOP by name"""
    run_sop(name, version)


@app.command()
def sop(
    action: str = typer.Argument(..., help="Action: new, list, show"),
    name: str = typer.Argument(None, help="SOP name"),
    version: str = typer.Option(None, "--version", help="SOP version"),
):
    """SOP management"""
    if action == "new":
        if not name:
            console.print("[red]Error: SOP name required[/red]")
            raise typer.Exit(1)
        sop_new(name)
    elif action == "list":
        sop_list()
    elif action == "show":
        if not name:
            console.print("[red]Error: SOP name required[/red]")
            raise typer.Exit(1)
        sop_show(name, version)
    else:
        console.print(f"[red]Unknown action: {action}[/red]")
        raise typer.Exit(1)


@app.command("rag-search")
def search(
    query: str = typer.Argument(..., help="Search query"),
    limit: int = typer.Option(5, "--limit", "-l", help="Max results"),
):
    """Search SOPs with semantic search"""
    rag_search(query, limit)


def main():
    """CLI entry point"""
    app()


if __name__ == "__main__":
    main()

"""Invoice Engine V2: Master Pipeline Orchestrator.

This script coordinates the execution of functional stages in the ETL pipeline.
It ensures that each stage is completed for the entire dataset before 
proceeding to the next, maintaining the 'Stage-Gating' execution model.
"""

import argparse
import sys
from v2.discovery import engine as discovery
from v2.conversion import engine as conversion

def main():
    """Main entry point for the V2 pipeline orchestrator."""
    parser = argparse.ArgumentParser(
        description="Invoice Engine V2: Pipeline Orchestrator"
    )
    parser.add_argument(
        "--stages", 
        nargs="+", 
        choices=["discovery", "conversion"],
        default=["discovery", "conversion"],
        help="Specific stages to run (default: all)"
    )
    args = parser.parse_args()

    print("\n" + "=" * 60)
    print("          INVOICE ENGINE V2: PIPELINE START")
    print("=" * 60 + "\n")

    # Run Discovery Stage
    if "discovery" in args.stages:
        try:
            discovery.run_discovery()
        except Exception as e:
            print(f"CRITICAL: Discovery stage failed: {e}")
            sys.exit(1)
    
    # Run Conversion Stage
    if "conversion" in args.stages:
        try:
            conversion.run_conversion()
        except Exception as e:
            print(f"CRITICAL: Conversion stage failed: {e}")
            sys.exit(1)

    print("\n" + "=" * 60)
    print("          PIPELINE EXECUTION FINISHED")
    print("=" * 60 + "\n")

if __name__ == "__main__":
    main()

using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AegiFitness.Api.Migrations
{
    /// <inheritdoc />
    public partial class TrainingSessionsAndBodyTracking : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "BodyFatPercent",
                table: "WeightEntries",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ChestCm",
                table: "WeightEntries",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "CreatedAt",
                table: "WeightEntries",
                type: "timestamp with time zone",
                nullable: false,
                defaultValueSql: "CURRENT_TIMESTAMP");

            migrationBuilder.AddColumn<decimal>(
                name: "HipCm",
                table: "WeightEntries",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "LeftArmCm",
                table: "WeightEntries",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "LeftThighCm",
                table: "WeightEntries",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "MuscleMassKg",
                table: "WeightEntries",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "NeckCm",
                table: "WeightEntries",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "RightArmCm",
                table: "WeightEntries",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "RightThighCm",
                table: "WeightEntries",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "WaistCm",
                table: "WeightEntries",
                type: "numeric",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ProgressPhotos",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    WeightEntryId = table.Column<Guid>(type: "uuid", nullable: false),
                    FileName = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    ContentType = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    Data = table.Column<byte[]>(type: "bytea", nullable: false),
                    Caption = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProgressPhotos", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProgressPhotos_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ProgressPhotos_WeightEntries_WeightEntryId",
                        column: x => x.WeightEntryId,
                        principalTable: "WeightEntries",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "WorkoutSetEntries",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    WorkoutLogEntryId = table.Column<Guid>(type: "uuid", nullable: false),
                    SetNumber = table.Column<int>(type: "integer", nullable: false),
                    PlannedReps = table.Column<int>(type: "integer", nullable: false),
                    PlannedWeightKg = table.Column<decimal>(type: "numeric", nullable: true),
                    ActualReps = table.Column<int>(type: "integer", nullable: true),
                    ActualWeightKg = table.Column<decimal>(type: "numeric", nullable: true),
                    Rir = table.Column<int>(type: "integer", nullable: true),
                    Completed = table.Column<bool>(type: "boolean", nullable: false),
                    CompletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WorkoutSetEntries", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WorkoutSetEntries_WorkoutLogEntries_WorkoutLogEntryId",
                        column: x => x.WorkoutLogEntryId,
                        principalTable: "WorkoutLogEntries",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ProgressPhotos_UserId",
                table: "ProgressPhotos",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_ProgressPhotos_WeightEntryId",
                table: "ProgressPhotos",
                column: "WeightEntryId");

            migrationBuilder.CreateIndex(
                name: "IX_WorkoutSetEntries_WorkoutLogEntryId_SetNumber",
                table: "WorkoutSetEntries",
                columns: new[] { "WorkoutLogEntryId", "SetNumber" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ProgressPhotos");

            migrationBuilder.DropTable(
                name: "WorkoutSetEntries");

            migrationBuilder.DropColumn(
                name: "BodyFatPercent",
                table: "WeightEntries");

            migrationBuilder.DropColumn(
                name: "ChestCm",
                table: "WeightEntries");

            migrationBuilder.DropColumn(
                name: "CreatedAt",
                table: "WeightEntries");

            migrationBuilder.DropColumn(
                name: "HipCm",
                table: "WeightEntries");

            migrationBuilder.DropColumn(
                name: "LeftArmCm",
                table: "WeightEntries");

            migrationBuilder.DropColumn(
                name: "LeftThighCm",
                table: "WeightEntries");

            migrationBuilder.DropColumn(
                name: "MuscleMassKg",
                table: "WeightEntries");

            migrationBuilder.DropColumn(
                name: "NeckCm",
                table: "WeightEntries");

            migrationBuilder.DropColumn(
                name: "RightArmCm",
                table: "WeightEntries");

            migrationBuilder.DropColumn(
                name: "RightThighCm",
                table: "WeightEntries");

            migrationBuilder.DropColumn(
                name: "WaistCm",
                table: "WeightEntries");
        }
    }
}

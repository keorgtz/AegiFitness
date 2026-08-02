using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AegiFitness.Api.Migrations
{
    /// <inheritdoc />
    public partial class ExerciseImages : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ImageSlug",
                table: "Exercises",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ImageVariants",
                table: "Exercises",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ImageSlug",
                table: "Exercises");

            migrationBuilder.DropColumn(
                name: "ImageVariants",
                table: "Exercises");
        }
    }
}

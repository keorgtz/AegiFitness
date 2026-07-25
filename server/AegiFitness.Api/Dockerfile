# ── Build ─────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY AegiFitness.Api/AegiFitness.Api.csproj AegiFitness.Api/
RUN dotnet restore AegiFitness.Api/AegiFitness.Api.csproj

COPY AegiFitness.Api/ AegiFitness.Api/
RUN dotnet publish AegiFitness.Api/AegiFitness.Api.csproj -c Release -o /app/publish --no-restore

# ── Runtime ───────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app

# curl para el healthcheck de Docker Compose (la imagen base no lo trae)
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/publish .

ENV ASPNETCORE_HTTP_PORTS=8080
EXPOSE 8080

ENTRYPOINT ["dotnet", "AegiFitness.Api.dll"]

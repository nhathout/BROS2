# BROS2 Workspace

Generated packages:

{% for p in packages %}
- **{{ p.name }}** ({{ p.lang }})
  - Nodes:
  {% for n in p.nodes %}
    - {{ n.name }} (exec: {{ n.executable }})
      - pubs: {{ (n.pubs or []) | length }}
      - subs: {{ (n.subs or []) | length }}
  {% endfor %}
{% endfor %}
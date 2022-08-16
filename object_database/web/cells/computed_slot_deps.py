class ComputedSlotDeps:
    """Explicitly tracks the set of ComputedSlot and ODB values we read.

    This needs to be versioned, since a ComputedSlot could read different
    values if it gets recomputed midway through an effect calculation.
    """

    def __init__(self, subSlots, subscriptions, subSlotDeps):
        self.subSlots = set(subSlots)
        self.subscriptions = set(subscriptions)
        self.subSlotDeps = set(subSlotDeps)

    def __str__(self):
        return (
            f"ComputedSlotDeps({len(self.subSlots)} slots"
            f" and {len(self.subscriptions)} subs)"
        )


